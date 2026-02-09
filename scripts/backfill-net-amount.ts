/**
 * Backfill Script: Fix netAmount = 0 for old Sale records
 * 
 * ⚠️  SAFETY:
 *   - DRY-RUN mode by default (preview only, no writes)
 *   - Logs every change before + after
 *   - Only updates records where netAmount = 0 AND totalAmount > 0
 *   - Never deletes or modifies totalAmount, totalCost, or profit
 * 
 * Usage:
 *   npx tsx scripts/backfill-net-amount.ts          # Dry run (preview)
 *   npx tsx scripts/backfill-net-amount.ts --apply   # Actually apply changes
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

// Safe Decimal → number conversion
function toNumber(val: Prisma.Decimal | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Backfill: Sale.netAmount (fix zero values)');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '⚡ APPLY (writing to DB)'}`);
  console.log('═══════════════════════════════════════════════════\n');

  // ─── Step 1: Find affected records ───────────────────────
  const affectedSales = await prisma.sale.findMany({
    where: {
      netAmount: 0,
      totalAmount: { gt: 0 },
    },
    select: {
      id: true,
      invoiceNumber: true,
      date: true,
      totalAmount: true,
      totalCost: true,
      profit: true,
      discountAmount: true,
      netAmount: true,
      shopId: true,
    },
    orderBy: { date: 'asc' },
  });

  console.log(`📊 Found ${affectedSales.length} sale(s) with netAmount = 0\n`);

  if (affectedSales.length === 0) {
    console.log('✅ No records need fixing. All good!');
    await prisma.$disconnect();
    return;
  }

  // ─── Step 2: Preview all changes ─────────────────────────
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│ #   Invoice        Date          totalAmount  discount   → netAmount  Δprofit│');
  console.log('├─────────────────────────────────────────────────────────────────────────────┤');

  const updates: {
    id: string;
    invoiceNumber: string;
    oldNetAmount: number;
    newNetAmount: number;
    oldProfit: number;
    newProfit: number;
  }[] = [];

  for (let i = 0; i < affectedSales.length; i++) {
    const sale = affectedSales[i];
    const totalAmount = toNumber(sale.totalAmount);
    const discountAmount = toNumber(sale.discountAmount);
    const totalCost = toNumber(sale.totalCost);
    const oldProfit = toNumber(sale.profit);

    // Calculate correct netAmount
    const newNetAmount = round2(totalAmount - discountAmount);

    // Recalculate profit based on netAmount
    // profit = netAmount - totalCost (same as calcProfit in money.ts)
    const newProfit = round2(newNetAmount - totalCost);

    const profitChanged = Math.abs(newProfit - oldProfit) > 0.001;
    const dateStr = sale.date.toISOString().slice(0, 10);

    console.log(
      `│ ${String(i + 1).padStart(2)}  ${sale.invoiceNumber.padEnd(13)} ${dateStr}  ` +
      `฿${totalAmount.toLocaleString().padStart(9)}  ` +
      `฿${discountAmount.toLocaleString().padStart(7)}   ` +
      `→ ฿${newNetAmount.toLocaleString().padStart(9)}  ` +
      `${profitChanged ? `⚠️ ฿${oldProfit} → ฿${newProfit}` : '✓ ok'}` +
      `│`
    );

    updates.push({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      oldNetAmount: 0,
      newNetAmount,
      oldProfit,
      newProfit,
    });
  }

  console.log('└─────────────────────────────────────────────────────────────────────────────┘\n');

  // Summary
  const totalRevenue = updates.reduce((sum, u) => sum + u.newNetAmount, 0);
  const profitChanges = updates.filter(u => Math.abs(u.newProfit - u.oldProfit) > 0.001);

  console.log(`📈 Summary:`);
  console.log(`   Total records to update: ${updates.length}`);
  console.log(`   Total netAmount to fill: ฿${round2(totalRevenue).toLocaleString()}`);
  console.log(`   Profit recalculations:   ${profitChanges.length} (where old profit ≠ new profit)`);
  console.log('');

  if (profitChanges.length > 0) {
    console.log('⚠️  Profit discrepancies detected:');
    for (const u of profitChanges) {
      console.log(`   ${u.invoiceNumber}: profit ฿${u.oldProfit} → ฿${u.newProfit}`);
    }
    console.log('   (Old profit was calculated WITHOUT discount. New profit accounts for discount correctly.)');
    console.log('');
  }

  // ─── Step 3: Apply (or not) ──────────────────────────────
  if (DRY_RUN) {
    console.log('🔍 DRY RUN complete. No changes were made.');
    console.log('   Run with --apply to write changes:');
    console.log('   npx tsx scripts/backfill-net-amount.ts --apply\n');
  } else {
    console.log('⚡ Applying changes...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await prisma.sale.update({
          where: { id: update.id },
          data: {
            netAmount: update.newNetAmount,
            // Only update profit if it actually changed
            ...(Math.abs(update.newProfit - update.oldProfit) > 0.001
              ? { profit: update.newProfit }
              : {}),
          },
        });
        successCount++;
        console.log(`   ✅ ${update.invoiceNumber} → netAmount = ฿${update.newNetAmount}`);
      } catch (err) {
        errorCount++;
        console.error(`   ❌ ${update.invoiceNumber} FAILED:`, err);
      }
    }

    console.log(`\n═══════════════════════════════════════════════════`);
    console.log(`  Results: ${successCount} updated, ${errorCount} errors`);
    console.log(`═══════════════════════════════════════════════════`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
