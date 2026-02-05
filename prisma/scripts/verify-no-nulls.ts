/**
 * Verify No Nulls Script
 * 
 * ตรวจสอบว่าไม่มี records ที่ shopId = NULL เหลืออยู่
 * ใช้หลังจาก run backfill script แล้ว
 * 
 * Usage: npx tsx prisma/scripts/verify-no-nulls.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyNoNulls() {
  console.log('🔍 Verifying no NULL shopId records remain...\n');
  
  const models = [
    'Product', 'Supplier', 'Customer', 'Purchase', 
    'Sale', 'Expense', 'Income', 'StockLog'
  ];

  let allClean = true;
  const issues: string[] = [];

  for (const model of models) {
    try {
      const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${model}" WHERE "shopId" IS NULL`
      );
      
      const count = Number(result[0].count);
      
      if (count > 0) {
        console.log(`❌ ${model}: ${count} records still have NULL shopId`);
        issues.push(`${model}: ${count}`);
        allClean = false;
      } else {
        console.log(`✅ ${model}: Clean`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${model}:`, error);
      allClean = false;
    }
  }

  console.log('');
  
  if (allClean) {
    console.log('✅ VERIFICATION PASSED: All records have shopId');
    console.log('📋 Ready for schema migration!');
    console.log('   Command: npx prisma migrate dev --name make-shopid-required');
  } else {
    console.log('❌ VERIFICATION FAILED: Some records still have NULL shopId');
    console.log('📋 Issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log('\nPlease investigate and fix before proceeding.');
    process.exit(1);
  }

  await prisma.$disconnect();
}

verifyNoNulls().catch((error) => {
  console.error('Verification failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
