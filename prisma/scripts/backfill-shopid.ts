/**
 * Backfill ShopId Migration Script
 * 
 * เติม shopId ให้ records ที่ยังไม่มี โดย:
 * 1. หา User ที่มี data แต่ยังไม่มี ShopMember
 * 2. สร้าง Shop ใหม่ให้ถ้าจำเป็น
 * 3. UPDATE shopId ให้ทุก records
 * 
 * Usage: npx tsx prisma/scripts/backfill-shopid.ts
 * 
 * ⚠️ IMPORTANT: Backup database before running!
 */

import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

// All permissions for auto-created Owner role
const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_UPDATE', 'SALE_CANCEL', 'SALE_VOID', 'SALE_VIEW_PROFIT', 'SALE_EDIT_LOCKED',
  'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_POST', 'INVOICE_CANCEL', 'INVOICE_MANAGE',
  'FINANCE_VIEW_LEDGER', 'FINANCE_PAYMENT_VOID', 'FINANCE_MANAGE_CREDIT',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST', 'STOCK_TAKE_APPROVE', 'WAREHOUSE_MANAGE',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_UPDATE', 'PURCHASE_VOID',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
  'RETURN_VIEW', 'RETURN_CREATE',
  'SETTINGS_SHOP', 'SETTINGS_ROLES', 'AUDIT_VIEW',
  'REPORT_VIEW_SALES', 'REPORT_EXPORT',
  'POS_ACCESS', 'SHIPMENT_VIEW', 'SHIPMENT_CREATE', 'SHIPMENT_EDIT', 'SHIPMENT_CANCEL',
  'QUOTATION_VIEW', 'QUOTATION_CREATE', 'QUOTATION_EDIT', 'QUOTATION_CONFIRM',
  'ORDER_REQUEST_VIEW', 'ORDER_REQUEST_CREATE', 'ORDER_REQUEST_SUBMIT',
  'APPROVAL_VIEW', 'APPROVAL_ACTION',
  'DELIVERY_VIEW', 'DELIVERY_VALIDATE'
];

interface BackfillStats {
  usersProcessed: number;
  shopsCreated: number;
  recordsUpdated: { [model: string]: number };
}

async function createShopForUser(
  userId: string,
  userName: string | null
): Promise<string> {
  const shopName = userName ? `${userName}'s Shop` : 'My Shop';

  return await prisma.$transaction(async (tx) => {
    // 1. Create Shop
    const shop = await tx.shop.create({
      data: {
        name: shopName,
        userId: userId,
      },
    });

    // 2. Create Owner Role
    const ownerRole = await tx.role.create({
      data: {
        name: 'Owner',
        description: 'เจ้าของร้าน - มีสิทธิ์ทั้งหมด',
        permissions: ALL_PERMISSIONS,
        isSystem: true,
        isDefault: false,
        shopId: shop.id,
      },
    });

    // 3. Create ShopMember
    await tx.shopMember.create({
      data: {
        userId: userId,
        shopId: shop.id,
        roleId: ownerRole.id,
        isOwner: true,
      },
    });

    return shop.id;
  });
}

async function backfillUserData(
  userId: string,
  shopId: string,
  stats: BackfillStats
): Promise<void> {
  const models = [
    'Product', 'Supplier', 'Customer', 'Purchase',
    'Sale', 'Expense', 'Income', 'StockLog'
  ];

  for (const model of models) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE "${model}" SET "shopId" = $1 WHERE "userId" = $2 AND "shopId" IS NULL`,
        shopId,
        userId
      );

      if (result > 0) {
        stats.recordsUpdated[model] = (stats.recordsUpdated[model] || 0) + result;
        console.log(`   ✅ ${model}: ${result} records updated`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${model}:`, error);
    }
  }
}

async function backfillShopId() {
  console.log('🚀 Starting ShopId Backfill Migration...\n');
  console.log('⚠️  Make sure you have a backup before proceeding!\n');

  const stats: BackfillStats = {
    usersProcessed: 0,
    shopsCreated: 0,
    recordsUpdated: {},
  };

  // 1. Find all users with NULL shopId data
  console.log('🔍 Finding users with NULL shopId data...\n');

  const usersWithNullData = await prisma.$queryRaw<Array<{
    userId: string;
    email: string;
    name: string | null
  }>>`
    SELECT DISTINCT u.id as "userId", u.email, u.name
    FROM "User" u
    WHERE EXISTS (SELECT 1 FROM "Product" p WHERE p."userId" = u.id AND p."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Sale" s WHERE s."userId" = u.id AND s."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Purchase" pu WHERE pu."userId" = u.id AND pu."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Expense" e WHERE e."userId" = u.id AND e."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Income" i WHERE i."userId" = u.id AND i."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Supplier" su WHERE su."userId" = u.id AND su."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Customer" c WHERE c."userId" = u.id AND c."shopId" IS NULL)
       OR EXISTS (SELECT 1 FROM "StockLog" sl WHERE sl."userId" = u.id AND sl."shopId" IS NULL)
  `;

  if (usersWithNullData.length === 0) {
    console.log('✅ No users with NULL shopId data found. Migration complete!\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`📋 Found ${usersWithNullData.length} users with NULL shopId data.\n`);

  // 2. Process each user
  for (const user of usersWithNullData) {
    console.log(`\n👤 Processing: ${user.email}`);
    stats.usersProcessed++;

    // Check if user already has a shop membership
    const membership = await prisma.shopMember.findFirst({
      where: { userId: user.userId },
      select: { shopId: true },
    });

    let shopId: string;

    if (membership) {
      // User already has shop membership, use that shopId
      shopId = membership.shopId;
      console.log(`   📦 Using existing shop: ${shopId}`);
    } else {
      // Check if user owns a shop directly
      const ownedShop = await prisma.shop.findFirst({
        where: { userId: user.userId },
      });

      if (ownedShop) {
        shopId = ownedShop.id;
        console.log(`   📦 Using owned shop: ${shopId}`);

        // Create ShopMember if missing
        const ownerRole = await prisma.role.findFirst({
          where: { shopId: ownedShop.id, isSystem: true },
        });

        if (ownerRole) {
          await prisma.shopMember.create({
            data: {
              userId: user.userId,
              shopId: ownedShop.id,
              roleId: ownerRole.id,
              isOwner: true,
            },
          });
          console.log(`   🔗 Created missing ShopMember`);
        }
      } else {
        // No shop at all - create new one
        console.log(`   🏪 Creating new shop for orphan user...`);
        shopId = await createShopForUser(user.userId, user.name);
        stats.shopsCreated++;
        console.log(`   ✅ Created shop: ${shopId}`);
      }
    }

    // 3. Backfill all data for this user
    await backfillUserData(user.userId, shopId, stats);
  }

  // 4. Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Users processed: ${stats.usersProcessed}`);
  console.log(`Shops created:   ${stats.shopsCreated}`);
  console.log('\nRecords updated per model:');

  for (const [model, count] of Object.entries(stats.recordsUpdated)) {
    console.log(`   ${model}: ${count}`);
  }

  console.log('\n✅ Backfill migration completed!');
  console.log('📋 Next step: Run npx tsx prisma/scripts/verify-no-nulls.ts');

  await prisma.$disconnect();
}

backfillShopId().catch((error) => {
  console.error('❌ Migration failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
