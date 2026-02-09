/**
 * Backfill purchaseNumber for legacy purchases that have null.
 * 
 * Logic:
 *   1. Group null-purchaseNumber purchases by shopId
 *   2. For each shop, find the current max PUR-XXXXX number
 *   3. Assign new numbers in chronological order (oldest first)
 *   4. Verify no collisions before writing
 *   5. DRY-RUN first, then APPLY with --apply flag
 * 
 * Usage:
 *   npx tsx scripts/fix-purchase-numbers.ts           # DRY-RUN (read-only)
 *   npx tsx scripts/fix-purchase-numbers.ts --apply    # APPLY changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  🔧 Backfill Purchase Numbers (${APPLY ? '⚡ APPLY MODE' : '👀 DRY-RUN'})`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // 1. Find all purchases without purchaseNumber
  const nullPurchases = await prisma.purchase.findMany({
    where: { purchaseNumber: null },
    select: { id: true, shopId: true, date: true, totalCost: true, createdAt: true },
    orderBy: { date: 'asc' }, // Oldest first
  });

  if (nullPurchases.length === 0) {
    console.log('  ✅ ไม่มี Purchase ที่ต้อง backfill\n');
    await prisma.$disconnect();
    return;
  }

  console.log(`  Found ${nullPurchases.length} purchases without purchaseNumber\n`);

  // 2. Group by shopId
  const byShop = new Map<string, typeof nullPurchases>();
  for (const p of nullPurchases) {
    const arr = byShop.get(p.shopId) || [];
    arr.push(p);
    byShop.set(p.shopId, arr);
  }

  // 3. Process each shop
  for (const [shopId, purchases] of Array.from(byShop)) {
    console.log(`  Shop: ${shopId.substring(0, 12)}...`);

    // Find all existing purchaseNumbers for this shop
    const existing = await prisma.purchase.findMany({
      where: { shopId, purchaseNumber: { not: null } },
      select: { purchaseNumber: true },
    });

    // Extract max number
    let maxNum = 0;
    const existingSet = new Set<string>();
    for (const e of existing) {
      if (!e.purchaseNumber) continue;
      existingSet.add(e.purchaseNumber);
      const match = e.purchaseNumber.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    console.log(`    Existing: ${existing.length} records (max: PUR-${String(maxNum).padStart(5, '0')})`);
    console.log(`    To assign: ${purchases.length} records\n`);

    // Sort by date then createdAt for deterministic order
    purchases.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // 4. Assign numbers
    let nextNum = maxNum + 1;
    const assignments: { id: string; purchaseNumber: string; date: string; totalCost: string }[] = [];

    for (const p of purchases) {
      const purchaseNumber = `PUR-${String(nextNum).padStart(5, '0')}`;

      // Safety: verify no collision
      if (existingSet.has(purchaseNumber)) {
        console.error(`    ❌ COLLISION: ${purchaseNumber} already exists! Aborting.`);
        await prisma.$disconnect();
        process.exit(1);
      }

      assignments.push({
        id: p.id,
        purchaseNumber,
        date: p.date.toISOString().split('T')[0],
        totalCost: `฿${Number(p.totalCost).toLocaleString()}`,
      });

      existingSet.add(purchaseNumber);
      nextNum++;
    }

    // Print plan
    for (const a of assignments) {
      console.log(`    ${APPLY ? '✅' : '📋'} ${a.purchaseNumber}  ←  date: ${a.date}, total: ${a.totalCost}`);
    }
    console.log('');

    // 5. Apply if --apply
    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        for (const a of assignments) {
          await tx.purchase.update({
            where: { id: a.id },
            data: { purchaseNumber: a.purchaseNumber },
          });
        }
      });
      console.log(`    ✅ Applied ${assignments.length} updates\n`);
    }
  }

  if (!APPLY) {
    console.log('  ⚠️  DRY-RUN — ไม่มีการแก้ข้อมูล');
    console.log('  ใช้ --apply เพื่อบันทึก:');
    console.log('  npx tsx scripts/fix-purchase-numbers.ts --apply\n');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
