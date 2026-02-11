/**
 * 🔬 Deep Data Integrity & Leak Audit v9 (READ-ONLY)
 *
 * Gaps not covered by v1–v8, verified against actual code:
 *
 *   1. Payment logic: CASH sale should always be VERIFIED
 *   2. Payment logic: TRANSFER+VERIFIED without paymentProof
 *   3. Cancelled purchase consistency: PURCHASE StockLogs without PURCHASE_CANCEL
 *   4. Active purchase with PURCHASE_CANCEL StockLogs (inverse)
 *   5. Product costPrice vs latest active purchase costPrice
 *   6. Empty purchases: Active purchase with 0 items
 *   7. Notification orphans: LOW_STOCK for soft-deleted products
 *   8. Shipment date anomalies: shippedAt > deliveredAt, createdAt > shippedAt
 *   9. Active sale with 0 totalAmount
 *  10. COMPLETED return without any RETURN StockLog
 *  11. StockLog with quantity = 0 (meaningless movement)
 *  12. Return on CANCELLED sale (should not exist)
 *
 * Verified against:
 *   - sales.ts L390: CASH → VERIFIED, else → PENDING
 *   - purchases.ts cancelPurchase: creates PURCHASE_CANCEL + reverts costPrice
 *   - returns.ts createReturn: StockService.recordMovement per item
 *
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v9.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNum(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

let totalIssues = 0;
let checkCount = 0;

function startCheck(name: string) {
  checkCount++;
  process.stdout.write(`  [${checkCount}] ${name}... `);
}

function endCheck(issues: number) {
  if (issues === 0) {
    console.log('✅ OK');
  } else {
    console.log(`❌ ${issues} issue(s)`);
    totalIssues += issues;
  }
}

// =====================================================================
// 1. CASH sales should always have paymentStatus = VERIFIED
//    (sales.ts L390: CASH → VERIFIED on creation)
// =====================================================================
async function checkCashAlwaysVerified() {
  startCheck('CASH sales with paymentStatus ≠ VERIFIED');

  const bad = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      paymentMethod: 'CASH',
      paymentStatus: { not: 'VERIFIED' },
    },
    select: { invoiceNumber: true, paymentStatus: true },
  });

  for (const s of bad) {
    console.log(`\n    ⚠️  ${s.invoiceNumber}: CASH but paymentStatus="${s.paymentStatus}"`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 2. TRANSFER sales VERIFIED but no paymentProof
//    (should have proof uploaded before verification)
// =====================================================================
async function checkTransferVerifiedNoProof() {
  startCheck('TRANSFER+VERIFIED sales without paymentProof');

  const bad = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      paymentMethod: 'TRANSFER',
      paymentStatus: 'VERIFIED',
      paymentProof: null,
    },
    select: { invoiceNumber: true, paymentVerifiedAt: true },
  });

  for (const s of bad) {
    console.log(
      `\n    ⚠️  ${s.invoiceNumber}: TRANSFER+VERIFIED but no paymentProof (verified: ${s.paymentVerifiedAt?.toISOString() ?? 'null'})`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 3. Cancelled purchase without PURCHASE_CANCEL StockLogs
//    (cancelPurchase creates PURCHASE_CANCEL for each item)
// =====================================================================
async function checkCancelledPurchaseNoStockCancel() {
  startCheck('Cancelled purchases without PURCHASE_CANCEL StockLogs');

  const cancelled = await prisma.purchase.findMany({
    where: { status: 'CANCELLED' },
    select: {
      id: true,
      purchaseNumber: true,
      items: { select: { productId: true } },
      stockLogs: { where: { type: 'PURCHASE_CANCEL' }, select: { id: true } },
    },
  });

  let issues = 0;
  for (const p of cancelled) {
    if (p.items.length > 0 && p.stockLogs.length === 0) {
      issues++;
      console.log(
        `\n    ⚠️  ${p.purchaseNumber || p.id.substring(0, 12)}: CANCELLED with ${p.items.length} items but 0 PURCHASE_CANCEL StockLogs`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 4. Active purchase with PURCHASE_CANCEL StockLogs (inverse check)
// =====================================================================
async function checkActivePurchaseWithCancelLogs() {
  startCheck('Active purchases with PURCHASE_CANCEL StockLogs');

  const bad = await prisma.purchase.findMany({
    where: {
      status: 'ACTIVE',
      stockLogs: { some: { type: 'PURCHASE_CANCEL' } },
    },
    select: {
      purchaseNumber: true,
      stockLogs: { where: { type: 'PURCHASE_CANCEL' }, select: { id: true } },
    },
  });

  for (const p of bad) {
    console.log(
      `\n    ⚠️  ${p.purchaseNumber}: ACTIVE but has ${p.stockLogs.length} PURCHASE_CANCEL logs`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 5. Product costPrice vs latest active purchase's costPrice
//    (createPurchase updates costPrice = latest purchase item cost)
// =====================================================================
async function checkProductCostVsLatestPurchase() {
  startCheck('Product costPrice vs latest purchase costPrice (INFO only)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, costPrice: true },
  });

  let mismatches = 0;
  for (const p of products) {
    const latestItem = await prisma.purchaseItem.findFirst({
      where: {
        productId: p.id,
        purchase: { status: 'ACTIVE' },
      },
      orderBy: { purchase: { date: 'desc' } },
      select: { costPrice: true, purchase: { select: { purchaseNumber: true } } },
    });

    if (latestItem) {
      const productCost = toNum(p.costPrice);
      const purchaseCost = toNum(latestItem.costPrice);
      if (Math.abs(productCost - purchaseCost) > 0.01) {
        mismatches++;
        if (mismatches <= 5) {
          console.log(
            `\n    ℹ️  "${p.name}": costPrice=฿${productCost} but latest purchase (${latestItem.purchase.purchaseNumber})=฿${purchaseCost}`
          );
        }
      }
    }
  }
  if (mismatches > 5) console.log(`\n    ... and ${mismatches - 5} more`);
  // INFO-level: This can happen if costPrice was manually edited
  if (mismatches > 0) {
    console.log(`\n    ℹ️  ${mismatches} mismatch(es) — may be intentional edits`);
  }
  endCheck(0); // INFO only, don't count as issues
}

// =====================================================================
// 6. Empty purchases: Active purchase with 0 items
// =====================================================================
async function checkEmptyPurchases() {
  startCheck('Active purchases with 0 items');

  const empty = await prisma.purchase.findMany({
    where: { status: 'ACTIVE', items: { none: {} } },
    select: { purchaseNumber: true, id: true },
  });

  for (const p of empty) {
    console.log(`\n    ⚠️  ${p.purchaseNumber || p.id.substring(0, 12)}: Active purchase with 0 items`);
  }
  endCheck(empty.length);
}

// =====================================================================
// 7. Notification orphans: LOW_STOCK for soft-deleted products
// =====================================================================
async function checkNotificationOrphans() {
  startCheck('LOW_STOCK notifications for deleted products');

  const notifications = await prisma.notification.findMany({
    where: {
      type: 'LOW_STOCK',
      isRead: false,
    },
    select: { id: true, title: true, metadata: true, link: true },
  });

  let issues = 0;
  for (const n of notifications) {
    // Extract productId from metadata or link
    const meta = n.metadata as Record<string, string> | null;
    const productId = meta?.productId || n.link?.match(/\/products\/([a-z0-9]+)/i)?.[1];

    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { deletedAt: true, name: true },
      });

      if (!product) {
        issues++;
        console.log(`\n    ⚠️  Notification "${n.title}": product ${productId} not found`);
      } else if (product.deletedAt) {
        issues++;
        console.log(`\n    ⚠️  Notification "${n.title}": product "${product.name}" is soft-deleted`);
      }
    }
  }
  endCheck(issues);
}

// =====================================================================
// 8. Shipment date anomalies
// =====================================================================
async function checkShipmentDateAnomalies() {
  startCheck('Shipment date anomalies (shippedAt > deliveredAt, etc.)');

  const shipments = await prisma.shipment.findMany({
    where: {
      OR: [
        { status: 'DELIVERED' },
        { status: 'SHIPPED' },
      ],
    },
    select: {
      shipmentNumber: true,
      status: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
    },
  });

  let issues = 0;
  for (const s of shipments) {
    // SHIPPED/DELIVERED without shippedAt
    if ((s.status === 'SHIPPED' || s.status === 'DELIVERED') && !s.shippedAt) {
      issues++;
      console.log(`\n    ⚠️  ${s.shipmentNumber}: ${s.status} but shippedAt=null`);
    }

    // DELIVERED without deliveredAt
    if (s.status === 'DELIVERED' && !s.deliveredAt) {
      issues++;
      console.log(`\n    ⚠️  ${s.shipmentNumber}: DELIVERED but deliveredAt=null`);
    }

    // shippedAt > deliveredAt (backwards timeline)
    if (s.shippedAt && s.deliveredAt && s.shippedAt > s.deliveredAt) {
      issues++;
      console.log(
        `\n    ⚠️  ${s.shipmentNumber}: shippedAt (${s.shippedAt.toISOString()}) > deliveredAt (${s.deliveredAt.toISOString()})`
      );
    }

    // createdAt > shippedAt (shipped before created?)
    if (s.shippedAt && s.createdAt > s.shippedAt) {
      issues++;
      console.log(
        `\n    ⚠️  ${s.shipmentNumber}: createdAt (${s.createdAt.toISOString()}) > shippedAt (${s.shippedAt.toISOString()})`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 9. Active sale with totalAmount = 0
// =====================================================================
async function checkZeroAmountSales() {
  startCheck('Active sales with totalAmount = 0');

  const bad = await prisma.sale.findMany({
    where: { status: 'ACTIVE', totalAmount: { lte: 0 } },
    select: { invoiceNumber: true, totalAmount: true },
  });

  for (const s of bad) {
    console.log(`\n    ⚠️  ${s.invoiceNumber}: totalAmount=฿${toNum(s.totalAmount)}`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 10. COMPLETED return without any RETURN StockLog
//     (createReturn calls StockService.recordMovement per item)
// =====================================================================
async function checkReturnWithoutStockLog() {
  startCheck('COMPLETED returns without RETURN StockLogs');

  const returns = await prisma.return.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true,
      returnNumber: true,
      items: { select: { id: true } },
      stockLogs: { where: { type: 'RETURN' }, select: { id: true } },
    },
  });

  let issues = 0;
  for (const r of returns) {
    if (r.items.length > 0 && r.stockLogs.length === 0) {
      issues++;
      console.log(
        `\n    ⚠️  ${r.returnNumber}: COMPLETED with ${r.items.length} items but 0 RETURN StockLogs`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 11. StockLog with quantity = 0 (meaningless movement)
// =====================================================================
async function checkZeroQuantityStockLogs() {
  startCheck('StockLogs with quantity = 0');

  const bad = await prisma.stockLog.findMany({
    where: { quantity: 0 },
    select: { id: true, type: true, note: true, product: { select: { name: true } } },
  });

  for (const b of bad.slice(0, 5)) {
    console.log(`\n    ⚠️  ${b.type} for "${b.product.name}": quantity=0 (${b.note || 'no note'})`);
  }
  if (bad.length > 5) console.log(`\n    ... and ${bad.length - 5} more`);
  endCheck(bad.length);
}

// =====================================================================
// 12. Active (COMPLETED) return linked to CANCELLED sale
//     (should be prevented by createReturn validation)
// =====================================================================
async function checkReturnOnCancelledSale() {
  startCheck('Active returns on CANCELLED sales');

  const bad = await prisma.return.findMany({
    where: {
      status: 'COMPLETED',
      sale: { status: 'CANCELLED' },
    },
    select: {
      returnNumber: true,
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const b of bad) {
    console.log(
      `\n    ⚠️  ${b.returnNumber}: COMPLETED return on CANCELLED sale ${b.sale.invoiceNumber}`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log('');
  console.log('🔬 Data Integrity & Leak Audit v9');
  console.log('══════════════════════════════════════════');
  console.log('');

  // --- Payment Logic ---
  console.log('💳 Payment Logic Consistency');
  await checkCashAlwaysVerified();
  await checkTransferVerifiedNoProof();

  console.log('');

  // --- Purchase Consistency ---
  console.log('📦 Purchase Cancel Consistency');
  await checkCancelledPurchaseNoStockCancel();
  await checkActivePurchaseWithCancelLogs();
  await checkProductCostVsLatestPurchase();
  await checkEmptyPurchases();

  console.log('');

  // --- Notification & Shipment ---
  console.log('🔔 Notifications & Shipments');
  await checkNotificationOrphans();
  await checkShipmentDateAnomalies();

  console.log('');

  // --- Returns & Sales ---
  console.log('🔄 Return & Sale Integrity');
  await checkZeroAmountSales();
  await checkReturnWithoutStockLog();
  await checkZeroQuantityStockLogs();
  await checkReturnOnCancelledSale();

  // --- Summary ---
  console.log('');
  console.log('══════════════════════════════════════════');
  if (totalIssues === 0) {
    console.log(`✅ All ${checkCount} checks passed — no issues found`);
  } else {
    console.log(`❌ ${totalIssues} issue(s) found across ${checkCount} checks`);
  }

  console.log('');
  console.log('📊 Cumulative: v1(16) + v2(16) + v3(14) + v4(12) + v5(12) + v6(18) + v7(22) + v8(21) + v9(12) = 143 checks');
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
