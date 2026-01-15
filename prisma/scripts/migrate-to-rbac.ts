/**
 * RBAC Migration Script
 * 
 * This script migrates existing users to the new RBAC system by:
 * 1. Creating a Shop for each user who doesn't have one
 * 2. Creating an "Owner" role with full permissions for each shop
 * 3. Creating a ShopMember record linking the user to their shop
 * 4. Updating existing data (products, sales, etc.) with shopId
 * 
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/scripts/migrate-to-rbac.ts
 */

import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

// All permissions for the Owner role
const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_CANCEL',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_EDIT', 'EXPENSE_DELETE',
  'REPORT_VIEW_SALES', 'REPORT_VIEW_PROFIT', 'REPORT_EXPORT',
  'SETTINGS_SHOP', 'SETTINGS_LOOKUPS',
  'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_EDIT', 'TEAM_REMOVE',
  'POS_ACCESS',
];

async function main() {
  console.log('🚀 Starting RBAC Migration...\n');

  // 1. Find all users
  const users = await prisma.user.findMany({
    include: {
      shop: true,
      memberships: true,
    },
  });

  console.log(`Found ${users.length} users to process\n`);

  let migratedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    console.log(`Processing user: ${user.email}`);

    // Skip if user already has a shop membership
    if (user.memberships.length > 0) {
      console.log(`  ⏩ Already has ${user.memberships.length} membership(s), skipping\n`);
      skippedCount++;
      continue;
    }

    // Check if user has a shop
    let shop = user.shop;

    // Create shop if not exists
    if (!shop) {
      const shopName = user.name ? `${user.name}'s Shop` : `Shop ${user.email.split('@')[0]}`;
      shop = await prisma.shop.create({
        data: {
          name: shopName,
          userId: user.id,
        },
      });
      console.log(`  ✅ Created shop: ${shop.name}`);
    } else {
      console.log(`  ✅ Has existing shop: ${shop.name}`);
    }

    // Create Owner role for this shop
    let ownerRole = await prisma.role.findFirst({
      where: {
        shopId: shop.id,
        isSystem: true,
        name: 'Owner',
      },
    });

    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: {
          name: 'Owner',
          description: 'เจ้าของร้าน - มีสิทธิ์ทั้งหมด',
          permissions: ALL_PERMISSIONS,
          isSystem: true,
          isDefault: false,
          shopId: shop.id,
        },
      });
      console.log(`  ✅ Created Owner role`);
    } else {
      console.log(`  ✅ Owner role exists`);
    }

    // Create ShopMember record
    await prisma.shopMember.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        roleId: ownerRole.id,
        isOwner: true,
      },
    });
    console.log(`  ✅ Created ShopMember (isOwner=true)`);

    // Update user's data with shopId
    const updatePromises = [
      prisma.product.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.supplier.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.customer.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.purchase.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.sale.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.expense.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
      prisma.stockLog.updateMany({
        where: { userId: user.id, shopId: null },
        data: { shopId: shop.id },
      }),
    ];

    const results = await Promise.all(updatePromises);
    const totalUpdated = results.reduce((sum, r) => sum + r.count, 0);
    console.log(`  ✅ Updated ${totalUpdated} existing records with shopId\n`);

    migratedCount++;
  }

  console.log('━'.repeat(50));
  console.log(`\n✅ Migration Complete!`);
  console.log(`   Migrated: ${migratedCount} users`);
  console.log(`   Skipped:  ${skippedCount} users (already migrated)\n`);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
