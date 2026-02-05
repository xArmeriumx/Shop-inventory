/**
 * Pre-flight Check Script
 * 
 * ตรวจสอบจำนวน records ที่ shopId = NULL ก่อนทำ migration
 * เพื่อประเมินขอบเขตของ migration และตรวจสอบ data integrity
 * 
 * Usage: npx tsx prisma/scripts/preflight-check.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ModelCount {
  model: string;
  nullCount: number;
  totalCount: number;
}

async function preflightCheck() {
  console.log('🔍 Pre-flight Check: Analyzing NULL shopId records...\n');
  
  const models = [
    { name: 'Product', table: 'Product' },
    { name: 'Supplier', table: 'Supplier' },
    { name: 'Customer', table: 'Customer' },
    { name: 'Purchase', table: 'Purchase' },
    { name: 'Sale', table: 'Sale' },
    { name: 'Expense', table: 'Expense' },
    { name: 'Income', table: 'Income' },
    { name: 'StockLog', table: 'StockLog' },
  ];

  const results: ModelCount[] = [];

  for (const model of models) {
    try {
      const nullCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${model.table}" WHERE "shopId" IS NULL`
      );
      
      const totalCount = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*) as count FROM "${model.table}"`
      );

      results.push({
        model: model.name,
        nullCount: Number(nullCount[0].count),
        totalCount: Number(totalCount[0].count),
      });
    } catch (error) {
      console.error(`❌ Error checking ${model.name}:`, error);
    }
  }

  // Print results
  console.log('┌──────────────┬───────────┬───────────┬────────────┐');
  console.log('│ Model        │ NULL      │ Total     │ Status     │');
  console.log('├──────────────┼───────────┼───────────┼────────────┤');
  
  let hasNulls = false;
  
  for (const result of results) {
    const status = result.nullCount === 0 ? '✅ Clean' : '⚠️ Needs fix';
    if (result.nullCount > 0) hasNulls = true;
    
    console.log(
      `│ ${result.model.padEnd(12)} │ ${String(result.nullCount).padEnd(9)} │ ${String(result.totalCount).padEnd(9)} │ ${status.padEnd(10)} │`
    );
  }
  
  console.log('└──────────────┴───────────┴───────────┴────────────┘\n');

  // Check for orphan users (users with data but no shop membership)
  console.log('🔍 Checking for orphan users (data without shop membership)...\n');
  
  const orphanCheck = await prisma.$queryRaw<Array<{ userId: string; email: string; productCount: bigint }>>`
    SELECT u.id as "userId", u.email, COUNT(p.id) as "productCount"
    FROM "User" u
    LEFT JOIN "ShopMember" sm ON u.id = sm."userId"
    LEFT JOIN "Product" p ON u.id = p."userId"
    WHERE sm.id IS NULL AND p.id IS NOT NULL
    GROUP BY u.id, u.email
  `;

  if (orphanCheck.length === 0) {
    console.log('✅ No orphan users found\n');
  } else {
    console.log(`⚠️ Found ${orphanCheck.length} orphan users:\n`);
    for (const user of orphanCheck) {
      console.log(`   - ${user.email}: ${user.productCount} products`);
    }
    console.log('');
  }

  // Summary
  if (hasNulls) {
    console.log('⚠️ SUMMARY: Found records with NULL shopId. Run backfill script before schema migration.');
    console.log('   Command: npx tsx prisma/scripts/backfill-shopid.ts');
  } else {
    console.log('✅ SUMMARY: All records have shopId. Ready for schema migration.');
    console.log('   Command: npx prisma migrate dev --name make-shopid-required');
  }

  await prisma.$disconnect();
}

preflightCheck().catch((error) => {
  console.error('Pre-flight check failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
