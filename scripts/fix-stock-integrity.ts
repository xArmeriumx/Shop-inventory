/**
 * 🔧 Fix Stock Integrity — ซ่อมข้อมูล Stock ที่ drift
 * 
 * ⚠️ DRY-RUN by default — ใช้ --apply เพื่อเขียนจริง
 * 
 * Phases:
 *   A. Phantom Stock   — สร้าง ADJUSTMENT StockLog สำหรับ products ที่มี stock แต่ไม่มี log
 *   B. Sign Fix        — แก้ SALE StockLogs ที่ qty เป็น + ให้เป็น -
 *   C. Rebalance Chain — คำนวณ balance ใหม่ทั้ง chain ทุก product
 *   D. Sync Stock      — ตั้ง Product.stock = last StockLog.balance
 * 
 * Usage:
 *   npx tsx scripts/fix-stock-integrity.ts           # DRY-RUN
 *   npx tsx scripts/fix-stock-integrity.ts --apply    # APPLY
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ── Helpers ─────────────────────────────────────────────────────────────────

function header(text: string) {
  console.log('');
  console.log('──────────────────────────────────────────────────────────');
  console.log(`  ${text}`);
  console.log('──────────────────────────────────────────────────────────');
}

// ── Phase A: Missing Initial Stock ─────────────────────────────────────────

async function phaseA() {
  header('Phase A: Missing Initial Stock — backfill ADJUSTMENT log');
  console.log('  (products ที่ Product.stock ≠ SUM(StockLog.qty))');

  // Get all active products
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true, userId: true, shopId: true, createdAt: true },
  });

  type Fix = { id: string; name: string; stock: number; sumQty: number; gap: number; userId: string; shopId: string; createdAt: Date; hasLogs: boolean };
  const fixes: Fix[] = [];

  for (const p of products) {
    // Sum all existing StockLog quantities for this product
    const agg = await prisma.stockLog.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true },
      _count: true,
    });

    const sumQty = agg._sum.quantity ?? 0;
    const gap = p.stock - sumQty;

    // If gap != 0, there's missing initial stock (or an adjustment needed)
    if (gap !== 0) {
      fixes.push({
        id: p.id,
        name: p.name,
        stock: p.stock,
        sumQty,
        gap,
        userId: p.userId,
        shopId: p.shopId,
        createdAt: p.createdAt,
        hasLogs: agg._count > 0,
      });
    }
  }

  console.log(`\n  Found ${fixes.length} products with stock gap\n`);

  if (fixes.length === 0) {
    console.log('  ✅ ไม่มีอะไรต้องแก้');
    return 0;
  }

  for (const f of fixes) {
    const tag = f.hasLogs ? '(has logs, missing initial)' : '(no logs = phantom)';
    console.log(`  ${APPLY ? '✅' : '📋'} ${f.name}: stock=${f.stock}, SUM(qty)=${f.sumQty}, gap=${f.gap > 0 ? '+' : ''}${f.gap} ${tag}`);
  }

  if (APPLY) {
    console.log(`\n  Applying ${fixes.length} ADJUSTMENT logs...`);
    await prisma.$transaction(async (tx) => {
      for (const f of fixes) {
        // Get the earliest existing log date to place our backfill BEFORE it
        const earliestLog = await tx.stockLog.findFirst({
          where: { productId: f.id },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
          select: { date: true },
        });

        // Place the backfill log 1 second before the earliest log, or at product creation
        const backfillDate = earliestLog
          ? new Date(earliestLog.date.getTime() - 1000)
          : f.createdAt;

        await tx.stockLog.create({
          data: {
            type: 'ADJUSTMENT',
            productId: f.id,
            quantity: f.gap,
            balance: f.gap, // First log in chain, so balance = quantity
            note: `[Auto-fix] สต็อกเริ่มต้นที่ไม่ได้บันทึก (backfill gap=${f.gap > 0 ? '+' : ''}${f.gap})`,
            date: backfillDate,
            userId: f.userId,
            shopId: f.shopId,
          },
        });
      }
    }, { timeout: 30000 });
    console.log(`  ✅ สร้าง ${fixes.length} ADJUSTMENT logs`);
  }

  return fixes.length;
}


// ── Phase B: Sign Fix ──────────────────────────────────────────────────────

async function phaseB() {
  header('Phase B: Sign Fix — แก้ SALE StockLogs ที่ qty เป็น + ให้เป็น -');

  // SALE and SALE_CANCEL types: SALE should be negative, SALE_CANCEL should be positive
  const badSaleLogs = await prisma.stockLog.findMany({
    where: {
      type: 'SALE',
      quantity: { gt: 0 }, // Positive = wrong for SALE
    },
    select: { id: true, productId: true, quantity: true, note: true },
  });

  console.log(`\n  Found ${badSaleLogs.length} SALE logs with positive quantity\n`);

  if (badSaleLogs.length === 0) {
    console.log('  ✅ ไม่มีอะไรต้องแก้');
    return 0;
  }

  for (const log of badSaleLogs) {
    console.log(`  ${APPLY ? '✅' : '📋'} ${log.id.substring(0, 15)}... qty=${log.quantity} → qty=${-log.quantity}`);
  }

  if (APPLY) {
    console.log(`\n  Applying ${badSaleLogs.length} sign fixes...`);
    await prisma.$transaction(async (tx) => {
      for (const log of badSaleLogs) {
        await tx.stockLog.update({
          where: { id: log.id },
          data: { quantity: -log.quantity },
        });
      }
    }, { timeout: 30000 });
    console.log(`  ✅ แก้ sign ${badSaleLogs.length} records`);
  }

  return badSaleLogs.length;
}

// ── Phase C: Rebalance Chain ───────────────────────────────────────────────

async function phaseC() {
  header('Phase C: Rebalance — คำนวณ balance chain ใหม่ทุก product');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let totalFixed = 0;
  let totalChecked = 0;

  for (const product of products) {
    const logs = await prisma.stockLog.findMany({
      where: { productId: product.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, quantity: true, balance: true },
    });

    if (logs.length === 0) continue;
    totalChecked++;

    let runningBalance = 0;
    const fixes: { id: string; oldBalance: number; newBalance: number }[] = [];

    for (const log of logs) {
      runningBalance += log.quantity;
      if (log.balance !== runningBalance) {
        fixes.push({
          id: log.id,
          oldBalance: log.balance,
          newBalance: runningBalance,
        });
      }
    }

    if (fixes.length > 0) {
      totalFixed += fixes.length;
      console.log(`\n  ${APPLY ? '✅' : '📋'} ${product.name}: ${fixes.length} balance fixes (${logs.length} logs)`);
      // Show first 3
      for (const f of fixes.slice(0, 3)) {
        console.log(`    ${f.id.substring(0, 15)}... balance: ${f.oldBalance} → ${f.newBalance}`);
      }
      if (fixes.length > 3) {
        console.log(`    ... and ${fixes.length - 3} more`);
      }

      if (APPLY) {
        await prisma.$transaction(async (tx) => {
          for (const f of fixes) {
            await tx.stockLog.update({
              where: { id: f.id },
              data: { balance: f.newBalance },
            });
          }
        }, { timeout: 30000 });
      }
    }
  }

  console.log(`\n  Checked ${totalChecked} products with logs`);
  if (totalFixed === 0) {
    console.log('  ✅ Balance chain ถูกต้องทุก product');
  } else {
    console.log(`  ${APPLY ? '✅ แก้แล้ว' : '📋 ต้องแก้'} ${totalFixed} balance entries`);
  }

  return totalFixed;
}

// ── Phase D: Sync Product.stock ────────────────────────────────────────────

async function phaseD() {
  header('Phase D: Sync — ตั้ง Product.stock = last StockLog.balance');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true },
  });

  const fixes: { id: string; name: string; currentStock: number; correctStock: number }[] = [];

  for (const product of products) {
    // Get last StockLog for this product (by date + createdAt)
    const lastLog = await prisma.stockLog.findFirst({
      where: { productId: product.id },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { balance: true },
    });

    if (!lastLog) {
      // No StockLog at all — if stock > 0, it should be 0
      // But Phase A should have created a log for phantom stocks
      // This handles products with stock = 0 and no logs (OK state)
      continue;
    }

    if (product.stock !== lastLog.balance) {
      fixes.push({
        id: product.id,
        name: product.name,
        currentStock: product.stock,
        correctStock: lastLog.balance,
      });
    }
  }

  console.log(`\n  Found ${fixes.length} products with stock ≠ last StockLog.balance\n`);

  if (fixes.length === 0) {
    console.log('  ✅ Product.stock ตรงกับ StockLog ทุกตัว');
    return 0;
  }

  for (const f of fixes) {
    console.log(`  ${APPLY ? '✅' : '📋'} ${f.name}: stock ${f.currentStock} → ${f.correctStock}`);
  }

  if (APPLY) {
    console.log(`\n  Applying ${fixes.length} stock sync updates...`);
    await prisma.$transaction(async (tx) => {
      for (const f of fixes) {
        await tx.product.update({
          where: { id: f.id },
          data: {
            stock: f.correctStock,
            isLowStock: f.correctStock <= 5, // Recalculate low stock flag (using default minStock)
          },
        });
      }
    }, { timeout: 30000 });
    console.log(`  ✅ Synced ${fixes.length} product stocks`);
  }

  return fixes.length;
}

// ── Phase D+: Low Stock Flag ───────────────────────────────────────────────

async function phaseLowStock() {
  header('Phase D+: Low Stock Flag — sync isLowStock ทุก product');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true, minStock: true, isLowStock: true },
  });

  let fixed = 0;
  for (const p of products) {
    const shouldBe = p.stock <= p.minStock;
    if (p.isLowStock !== shouldBe) {
      console.log(`  ${APPLY ? '✅' : '📋'} ${p.name}: isLowStock ${p.isLowStock} → ${shouldBe} (stock=${p.stock}, min=${p.minStock})`);
      if (APPLY) {
        await prisma.product.update({
          where: { id: p.id },
          data: { isLowStock: shouldBe },
        });
      }
      fixed++;
    }
  }

  if (fixed === 0) {
    console.log('  ✅ isLowStock flag ถูกต้องทุกตัว');
  } else {
    console.log(`\n  ${APPLY ? '✅ แก้แล้ว' : '📋 ต้องแก้'} ${fixed} flags`);
  }

  return fixed;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  🔧 Stock Integrity Fix (${APPLY ? '⚡ APPLY' : '👀 DRY-RUN'})`);
  console.log('══════════════════════════════════════════════════════════');

  // Phase order matters! A → B → C → D
  const countA = await phaseA();
  const countB = await phaseB();
  const countC = await phaseC();
  const countD = await phaseD();
  const countLow = await phaseLowStock();

  header('📋 Summary');
  console.log(`  Phase A (Phantom Stock):   ${countA} fixes`);
  console.log(`  Phase B (Sign Fix):        ${countB} fixes`);
  console.log(`  Phase C (Rebalance):       ${countC} fixes`);
  console.log(`  Phase D (Sync Stock):      ${countD} fixes`);
  console.log(`  Phase D+ (Low Stock Flag): ${countLow} fixes`);
  const total = countA + countB + countC + countD + countLow;
  console.log(`\n  Total: ${total} fixes`);

  if (!APPLY && total > 0) {
    console.log(`\n  ⚠️ DRY-RUN — ไม่มีการแก้ข้อมูล`);
    console.log(`  npx tsx scripts/fix-stock-integrity.ts --apply\n`);
  } else if (total === 0) {
    console.log(`\n  ✅ ไม่มีอะไรต้องแก้!\n`);
  } else {
    console.log(`\n  ✅ Applied all fixes!\n`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
