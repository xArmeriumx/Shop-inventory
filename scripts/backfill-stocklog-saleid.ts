/**
 * Backfill: Move referenceId → saleId for legacy SALE StockLogs
 *
 * Targets: StockLog records where type='SALE', saleId=null, referenceId is set
 * Validates: referenceId actually points to an existing Sale before updating
 *
 * Usage: npx tsx scripts/backfill-stocklog-saleid.ts
 */

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const logs = await p.stockLog.findMany({
    where: { type: 'SALE', saleId: null, referenceId: { not: null } },
    select: { id: true, referenceId: true, note: true },
  });

  console.log(`\nFound ${logs.length} SALE StockLogs to backfill\n`);

  let fixed = 0;
  let skipped = 0;

  for (const log of logs) {
    // Validate: referenceId → Sale exists
    const sale = await p.sale.findUnique({
      where: { id: log.referenceId! },
      select: { id: true, invoiceNumber: true },
    });

    if (!sale) {
      console.log(`  ⚠️  SKIP ${log.id}: referenceId=${log.referenceId} not found in Sale table`);
      skipped++;
      continue;
    }

    await p.stockLog.update({
      where: { id: log.id },
      data: { saleId: sale.id },
    });

    console.log(`  ✅ ${log.id} → saleId=${sale.id} (${sale.invoiceNumber})`);
    fixed++;
  }

  console.log(`\n=== Done: ${fixed} fixed, ${skipped} skipped ===\n`);
  await p.$disconnect();
}

main();
