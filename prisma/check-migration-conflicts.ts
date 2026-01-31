/**
 * Pre-Migration Validation Script
 * ตรวจสอบ conflicts ก่อนทำ migration จาก userId constraint → shopId constraint
 * 
 * รัน: npx ts-node prisma/check-migration-conflicts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 === Pre-Migration Conflict Check ===\n');
  
  let hasConflicts = false;
  let hasNullShopIds = false;

  // ============================================
  // 1. Check for NULL shopId records
  // ============================================
  console.log('📋 Phase 1: Checking for NULL shopId records...\n');
  
  const productsWithoutShopId = await prisma.product.count({
    where: { shopId: null }
  });
  
  const salesWithoutShopId = await prisma.sale.count({
    where: { shopId: null }
  });
  
  if (productsWithoutShopId > 0 || salesWithoutShopId > 0) {
    hasNullShopIds = true;
    console.log('⚠️  Records without shopId found:');
    console.log(`   - Products: ${productsWithoutShopId}`);
    console.log(`   - Sales: ${salesWithoutShopId}`);
    console.log('   → These will be backfilled from User\'s Shop\n');
  } else {
    console.log('✅ All records have shopId assigned\n');
  }

  // ============================================
  // 2. Check for duplicate SKUs within same shopId
  // ============================================
  console.log('📋 Phase 2: Checking for duplicate SKUs per shopId...\n');
  
  const duplicateSKUs = await prisma.$queryRaw<Array<{shopId: string, sku: string, count: bigint}>>`
    SELECT "shopId", sku, COUNT(*) as count
    FROM "Product"
    WHERE "shopId" IS NOT NULL 
      AND sku IS NOT NULL 
      AND "isActive" = true
    GROUP BY "shopId", sku
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateSKUs.length > 0) {
    hasConflicts = true;
    console.log('❌ Duplicate SKUs found within same shop:');
    for (const dup of duplicateSKUs) {
      console.log(`   - shopId: ${dup.shopId}, SKU: ${dup.sku}, Count: ${dup.count}`);
    }
    console.log('   → Must resolve these before migration!\n');
  } else {
    console.log('✅ No duplicate SKUs within any shop\n');
  }

  // ============================================
  // 3. Check for duplicate invoiceNumbers within same shopId
  // ============================================
  console.log('📋 Phase 3: Checking for duplicate invoiceNumbers per shopId...\n');
  
  const duplicateInvoices = await prisma.$queryRaw<Array<{shopId: string, invoiceNumber: string, count: bigint}>>`
    SELECT "shopId", "invoiceNumber", COUNT(*) as count
    FROM "Sale"
    WHERE "shopId" IS NOT NULL
    GROUP BY "shopId", "invoiceNumber"
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateInvoices.length > 0) {
    hasConflicts = true;
    console.log('❌ Duplicate invoiceNumbers found within same shop:');
    for (const dup of duplicateInvoices) {
      console.log(`   - shopId: ${dup.shopId}, Invoice: ${dup.invoiceNumber}, Count: ${dup.count}`);
    }
    console.log('   → Must resolve these before migration!\n');
  } else {
    console.log('✅ No duplicate invoiceNumbers within any shop\n');
  }

  // ============================================
  // 4. Count total records for verification
  // ============================================
  console.log('📋 Phase 4: Record counts (save for post-migration verification)...\n');
  
  const totalProducts = await prisma.product.count();
  const totalSales = await prisma.sale.count();
  const totalPurchases = await prisma.purchase.count();
  
  console.log('📊 Current Record Counts:');
  console.log(`   - Products: ${totalProducts}`);
  console.log(`   - Sales: ${totalSales}`);
  console.log(`   - Purchases: ${totalPurchases}`);
  console.log('   → Save these numbers to verify no data loss after migration\n');

  // ============================================
  // Summary
  // ============================================
  console.log('='.repeat(50));
  console.log('📋 Summary:\n');
  
  if (hasConflicts) {
    console.log('❌ CONFLICTS DETECTED - Cannot proceed with migration');
    console.log('   Please resolve the duplicate records above first.');
    process.exit(1);
  } else if (hasNullShopIds) {
    console.log('⚠️  NULL shopId records found - Will be auto-backfilled');
    console.log('   Migration can proceed with backfill step first.');
    process.exit(0);
  } else {
    console.log('✅ ALL CLEAR - Ready for migration!');
    console.log('   No conflicts or null shopIds detected.');
    process.exit(0);
  }
}

main()
  .catch((e) => {
    console.error('Error running validation:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
