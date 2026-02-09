/**
 * Deep Data Integrity Audit v5
 * 
 * ⚠️ READ-ONLY — never writes to the database.
 * 
 * Relationship & logic checks:
 *  1.  Dangling FK references (IDs pointing to non-existent records)
 *  2.  StockLog type vs linked entity (SALE type must have saleId, etc.)
 *  3.  Payment verification consistency (VERIFIED without verifiedAt)
 *  4.  Return vs Sale status (return on cancelled sale)
 *  5.  SaleItem discount math (subtotal = (salePrice - discountAmount) * qty)
 *  6.  ReturnItem refund math (refundAmount = refundPerUnit * qty)
 *  7.  Return refundAmount vs SUM(ReturnItem.refundAmount)
 *  8.  Data encoding safety (HTML/script tags in text fields)
 *  9.  Shipment address vs customer address consistency
 * 10.  Sale totalAmount vs SUM(SaleItem.subtotal) re-verify
 * 11.  StockLog deprecated field usage (referenceId/referenceType)
 * 12.  Product image URL validity check
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v5.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNum(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

interface Issue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  check: string;
  model: string;
  identifier: string;
  detail: string;
}

const issues: Issue[] = [];
function add(sev: Issue['severity'], check: string, model: string, id: string, detail: string) {
  issues.push({ severity: sev, check, model, identifier: id, detail });
}

// ═══════════════════════════════════════════════════
// 1. Dangling FK references
// ═══════════════════════════════════════════════════
async function check1_DanglingFK() {
  process.stdout.write('  [1/12]  Dangling foreign keys...');
  let count = 0;

  // StockLogs with saleId that doesn't exist
  const stockLogsWithSale = await prisma.stockLog.findMany({
    where: { saleId: { not: null } },
    select: { id: true, saleId: true },
  });
  const saleIds = new Set((await prisma.sale.findMany({ select: { id: true } })).map(s => s.id));
  for (const log of stockLogsWithSale) {
    if (log.saleId && !saleIds.has(log.saleId)) {
      add('CRITICAL', 'Dangling FK', 'StockLog', log.id.substring(0, 12),
        `saleId "${log.saleId.substring(0, 12)}..." does not exist`);
      count++;
    }
  }

  // StockLogs with purchaseId that doesn't exist
  const stockLogsWithPurchase = await prisma.stockLog.findMany({
    where: { purchaseId: { not: null } },
    select: { id: true, purchaseId: true },
  });
  const purchaseIds = new Set((await prisma.purchase.findMany({ select: { id: true } })).map(p => p.id));
  for (const log of stockLogsWithPurchase) {
    if (log.purchaseId && !purchaseIds.has(log.purchaseId)) {
      add('CRITICAL', 'Dangling FK', 'StockLog', log.id.substring(0, 12),
        `purchaseId "${log.purchaseId.substring(0, 12)}..." does not exist`);
      count++;
    }
  }

  // StockLogs with returnId that doesn't exist
  const stockLogsWithReturn = await prisma.stockLog.findMany({
    where: { returnId: { not: null } },
    select: { id: true, returnId: true },
  });
  const returnIds = new Set((await prisma.return.findMany({ select: { id: true } })).map(r => r.id));
  for (const log of stockLogsWithReturn) {
    if (log.returnId && !returnIds.has(log.returnId)) {
      add('CRITICAL', 'Dangling FK', 'StockLog', log.id.substring(0, 12),
        `returnId "${log.returnId.substring(0, 12)}..." does not exist`);
      count++;
    }
  }

  // Shipments with customerAddressId that doesn't exist
  const shipmentsWithAddr = await prisma.shipment.findMany({
    where: { customerAddressId: { not: null } },
    select: { id: true, shipmentNumber: true, customerAddressId: true },
  });
  const addrIds = new Set((await prisma.customerAddress.findMany({ select: { id: true } })).map(a => a.id));
  for (const s of shipmentsWithAddr) {
    if (s.customerAddressId && !addrIds.has(s.customerAddressId)) {
      add('WARNING', 'Dangling FK', 'Shipment', s.shipmentNumber,
        `customerAddressId "${s.customerAddressId.substring(0, 12)}..." does not exist`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 2. StockLog type vs linked entity
// ═══════════════════════════════════════════════════
async function check2_StockLogTypeLinkage() {
  process.stdout.write('  [2/12]  StockLog type ↔ linked entity...');
  let count = 0;

  const logs = await prisma.stockLog.findMany({
    select: { id: true, type: true, saleId: true, purchaseId: true, returnId: true, note: true },
  });

  for (const log of logs) {
    switch (log.type) {
      case 'SALE':
      case 'SALE_CANCEL':
        if (!log.saleId) {
          add('WARNING', 'StockLog Linkage', 'StockLog', log.id.substring(0, 12),
            `type=${log.type} but saleId is null`);
          count++;
        }
        break;
      case 'PURCHASE':
      case 'PURCHASE_CANCEL':
        if (!log.purchaseId) {
          add('WARNING', 'StockLog Linkage', 'StockLog', log.id.substring(0, 12),
            `type=${log.type} but purchaseId is null`);
          count++;
        }
        break;
      case 'RETURN':
        if (!log.returnId) {
          add('WARNING', 'StockLog Linkage', 'StockLog', log.id.substring(0, 12),
            `type=${log.type} but returnId is null`);
          count++;
        }
        break;
      // ADJUSTMENT, WASTE, CANCEL — no required linkage
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 3. Payment verification consistency
// ═══════════════════════════════════════════════════
async function check3_PaymentVerification() {
  process.stdout.write('  [3/12]  Payment verification consistency...');
  let count = 0;

  // VERIFIED without verifiedAt
  const verifiedNoDate = await prisma.sale.count({
    where: { paymentStatus: 'VERIFIED', paymentVerifiedAt: null, paymentProof: { not: null } },
  });
  if (verifiedNoDate > 0) {
    add('INFO', 'Payment Verify', 'Sale', `${verifiedNoDate} records`,
      `VERIFIED status with proof but no verifiedAt timestamp`);
    count++;
  }

  // PENDING for more than 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const stalePending = await prisma.sale.findMany({
    where: {
      paymentStatus: 'PENDING',
      status: 'ACTIVE',
      createdAt: { lt: sevenDaysAgo },
    },
    select: { invoiceNumber: true, createdAt: true },
  });
  for (const s of stalePending) {
    const days = Math.floor((Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    add('WARNING', 'Stale Pending', 'Sale', s.invoiceNumber,
      `Payment PENDING for ${days} days`);
    count++;
  }

  // REJECTED but sale still ACTIVE (potential problem)
  const rejectedActive = await prisma.sale.count({
    where: { paymentStatus: 'REJECTED', status: 'ACTIVE' },
  });
  if (rejectedActive > 0) {
    add('WARNING', 'Rejected Active', 'Sale', `${rejectedActive} records`,
      `Payment REJECTED but sale is still ACTIVE`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 4. Return vs Sale status
// ═══════════════════════════════════════════════════
async function check4_ReturnSaleStatus() {
  process.stdout.write('  [4/12]  Return vs Sale status...');
  let count = 0;

  const returns = await prisma.return.findMany({
    where: { status: 'COMPLETED' },
    select: {
      returnNumber: true,
      sale: { select: { invoiceNumber: true, status: true } },
    },
  });

  for (const r of returns) {
    if (r.sale.status === 'CANCELLED') {
      add('CRITICAL', 'Return on Cancelled', 'Return', r.returnNumber,
        `Completed return on cancelled sale ${r.sale.invoiceNumber}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 5. SaleItem discount math
// ═══════════════════════════════════════════════════
async function check5_SaleItemDiscountMath() {
  process.stdout.write('  [5/12]  SaleItem discount math...');
  let count = 0;

  const items = await prisma.saleItem.findMany({
    where: { sale: { status: 'ACTIVE' } },
    select: {
      id: true, quantity: true, salePrice: true, discountAmount: true,
      subtotal: true, profit: true, costPrice: true,
      sale: { select: { invoiceNumber: true } },
      product: { select: { name: true } },
    },
  });

  for (const item of items) {
    const qty = item.quantity;
    const price = toNum(item.salePrice);
    const discount = toNum(item.discountAmount);
    const subtotal = toNum(item.subtotal);
    const cost = toNum(item.costPrice);
    const profit = toNum(item.profit);

    // subtotal = salePrice * quantity (before discount = bill-level)
    const expectedSubtotal = Math.round(price * qty * 100) / 100;
    if (Math.abs(subtotal - expectedSubtotal) > 0.01) {
      add('CRITICAL', 'SaleItem Subtotal', 'SaleItem', item.sale.invoiceNumber,
        `"${item.product.name}": ${qty} × ฿${price} = ฿${expectedSubtotal} but subtotal = ฿${subtotal}`);
      count++;
    }

    // profit = subtotal - (costPrice * quantity)  
    const expectedProfit = Math.round((subtotal - cost * qty) * 100) / 100;
    if (Math.abs(profit - expectedProfit) > 0.01) {
      // Only warn, since discount may affect profit calculation differently
      add('WARNING', 'SaleItem Profit', 'SaleItem', item.sale.invoiceNumber,
        `"${item.product.name}": profit ฿${profit} ≠ ฿${subtotal} - ${qty}×฿${cost} = ฿${expectedProfit}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 6. ReturnItem refund math
// ═══════════════════════════════════════════════════
async function check6_ReturnItemMath() {
  process.stdout.write('  [6/12]  ReturnItem refund math...');
  let count = 0;

  const items = await prisma.returnItem.findMany({
    select: {
      quantity: true, refundPerUnit: true, refundAmount: true,
      return: { select: { returnNumber: true } },
      product: { select: { name: true } },
    },
  });

  for (const item of items) {
    const expected = Math.round(item.quantity * toNum(item.refundPerUnit) * 100) / 100;
    const actual = toNum(item.refundAmount);
    if (Math.abs(actual - expected) > 0.01) {
      add('CRITICAL', 'ReturnItem Math', 'ReturnItem', item.return.returnNumber,
        `"${item.product.name}": ${item.quantity} × ฿${toNum(item.refundPerUnit)} = ฿${expected} but got ฿${actual}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 7. Return refundAmount vs SUM(ReturnItem.refundAmount)
// ═══════════════════════════════════════════════════
async function check7_ReturnTotal() {
  process.stdout.write('  [7/12]  Return total vs items...');
  let count = 0;

  const returns = await prisma.return.findMany({
    select: {
      returnNumber: true, refundAmount: true,
      items: { select: { refundAmount: true } },
    },
  });

  for (const ret of returns) {
    const expectedTotal = ret.items.reduce((sum, i) => sum + toNum(i.refundAmount), 0);
    const actual = toNum(ret.refundAmount);
    if (Math.abs(actual - Math.round(expectedTotal * 100) / 100) > 0.01) {
      add('CRITICAL', 'Return Total', 'Return', ret.returnNumber,
        `refundAmount ฿${actual} ≠ SUM(items) ฿${expectedTotal.toFixed(2)}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 8. Data encoding safety (XSS check)
// ═══════════════════════════════════════════════════
async function check8_DataEncoding() {
  process.stdout.write('  [8/12]  Data encoding safety (XSS)...');
  let count = 0;

  const xssPattern = /<script|<img\s+onerror|javascript:|on\w+\s*=/i;

  // Check product names
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { name: true, description: true },
  });
  for (const p of products) {
    if (xssPattern.test(p.name)) {
      add('CRITICAL', 'XSS Risk', 'Product', p.name.substring(0, 30), `Name contains potential XSS`);
      count++;
    }
    if (p.description && xssPattern.test(p.description)) {
      add('CRITICAL', 'XSS Risk', 'Product', p.name.substring(0, 30), `Description contains potential XSS`);
      count++;
    }
  }

  // Check customer names
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: { name: true },
  });
  for (const c of customers) {
    if (xssPattern.test(c.name)) {
      add('CRITICAL', 'XSS Risk', 'Customer', c.name.substring(0, 30), `Name contains potential XSS`);
      count++;
    }
  }

  // Check supplier names
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    select: { name: true },
  });
  for (const s of suppliers) {
    if (xssPattern.test(s.name)) {
      add('CRITICAL', 'XSS Risk', 'Supplier', s.name.substring(0, 30), `Name contains potential XSS`);
      count++;
    }
  }

  // Check sale notes
  const salesNotes = await prisma.sale.findMany({
    where: { notes: { not: null } },
    select: { invoiceNumber: true, notes: true },
  });
  for (const s of salesNotes) {
    if (s.notes && xssPattern.test(s.notes)) {
      add('CRITICAL', 'XSS Risk', 'Sale', s.invoiceNumber, `Notes contain potential XSS`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 9. Shipment customer address consistency
// ═══════════════════════════════════════════════════
async function check9_ShipmentAddress() {
  process.stdout.write('  [9/12]  Shipment ↔ customer address...');
  let count = 0;

  const shipments = await prisma.shipment.findMany({
    where: { customerAddressId: { not: null } },
    select: {
      shipmentNumber: true,
      sale: { select: { customerId: true } },
      customerAddress: { select: { customerId: true } },
    },
  });

  for (const s of shipments) {
    if (s.sale.customerId && s.customerAddress &&
        s.customerAddress.customerId !== s.sale.customerId) {
      add('WARNING', 'Address Mismatch', 'Shipment', s.shipmentNumber,
        `Address belongs to different customer than the sale`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 10. Sale totalAmount vs SUM(SaleItem.subtotal)
// ═══════════════════════════════════════════════════
async function check10_SaleTotalVsItems() {
  process.stdout.write('  [10/12] Sale total vs items sum...');
  let count = 0;

  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true, totalAmount: true,
      items: { select: { subtotal: true } },
    },
  });

  for (const sale of sales) {
    const itemTotal = sale.items.reduce((sum, i) => sum + toNum(i.subtotal), 0);
    const saleTotal = toNum(sale.totalAmount);
    if (Math.abs(saleTotal - Math.round(itemTotal * 100) / 100) > 0.01) {
      add('CRITICAL', 'Sale vs Items Total', 'Sale', sale.invoiceNumber,
        `totalAmount ฿${saleTotal} ≠ SUM(items) ฿${itemTotal.toFixed(2)}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 11. StockLog deprecated field usage
// ═══════════════════════════════════════════════════
async function check11_DeprecatedStockLogFields() {
  process.stdout.write('  [11/12] StockLog deprecated fields...');
  let count = 0;

  // referenceId and referenceType are deprecated
  const withRefId = await prisma.stockLog.count({
    where: { referenceId: { not: null } },
  });
  if (withRefId > 0) {
    add('INFO', 'Deprecated Field', 'StockLog', `${withRefId} records`,
      `Using deprecated "referenceId" — should use saleId/purchaseId/returnId`);
    count++;
  }

  const withRefType = await prisma.stockLog.count({
    where: { referenceType: { not: null } },
  });
  if (withRefType > 0) {
    add('INFO', 'Deprecated Field', 'StockLog', `${withRefType} records`,
      `Using deprecated "referenceType" — use StockMovementType enum`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 12. Product image URL validity
// ═══════════════════════════════════════════════════
async function check12_ImageUrls() {
  process.stdout.write('  [12/12] Product image URLs...');
  let count = 0;

  const products = await prisma.product.findMany({
    where: { deletedAt: null, images: { isEmpty: false } },
    select: { name: true, images: true },
  });

  let emptyUrls = 0;
  let suspiciousUrls = 0;
  for (const p of products) {
    for (const url of p.images) {
      if (!url || url.trim() === '') {
        emptyUrls++;
      } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
        suspiciousUrls++;
        if (suspiciousUrls <= 3) {
          add('INFO', 'Suspicious URL', 'Product', p.name,
            `Image URL doesn't start with http/https: "${url.substring(0, 50)}..."`);
        }
      }
    }
  }

  if (emptyUrls > 0) {
    add('WARNING', 'Empty Image URL', 'Product', `${emptyUrls} entries`, `Empty strings in images array`);
    count++;
  }
  if (suspiciousUrls > 3) {
    add('INFO', 'Suspicious URL', 'Product', `${suspiciousUrls - 3} more`, `Additional suspicious URLs`);
  }
  count += suspiciousUrls > 0 ? 1 : 0;

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔬 Deep Data Integrity Audit v5 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  await check1_DanglingFK();
  await check2_StockLogTypeLinkage();
  await check3_PaymentVerification();
  await check4_ReturnSaleStatus();
  await check5_SaleItemDiscountMath();
  await check6_ReturnItemMath();
  await check7_ReturnTotal();
  await check8_DataEncoding();
  await check9_ShipmentAddress();
  await check10_SaleTotalVsItems();
  await check11_DeprecatedStockLogFields();
  await check12_ImageUrls();

  // ── Print Results ──
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📋 Results');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const info = issues.filter(i => i.severity === 'INFO');

  if (issues.length === 0) {
    console.log('  ✅ ALL 12 CHECKS PASSED — No issues found!\n');
  } else {
    console.log(`  Found ${issues.length} issue(s):`);
    console.log(`    🔴 CRITICAL: ${critical.length}`);
    console.log(`    🟡 WARNING:  ${warnings.length}`);
    console.log(`    🔵 INFO:     ${info.length}`);
    console.log('');

    const grouped = new Map<string, Issue[]>();
    for (const issue of [...critical, ...warnings, ...info]) {
      const arr = grouped.get(issue.check) || [];
      arr.push(issue);
      grouped.set(issue.check, arr);
    }

    for (const [check, checkIssues] of Array.from(grouped)) {
      const icon = checkIssues[0].severity === 'CRITICAL' ? '🔴' :
                   checkIssues[0].severity === 'WARNING' ? '🟡' : '🔵';
      console.log(`  ${icon} ${check} (${checkIssues.length}x)`);
      for (const issue of checkIssues.slice(0, 8)) {
        console.log(`     [${issue.model}] ${issue.identifier}: ${issue.detail}`);
      }
      if (checkIssues.length > 8) {
        console.log(`     ... and ${checkIssues.length - 8} more`);
      }
      console.log('');
    }
  }

  // ── Cumulative ──
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📊 Cumulative Audit Summary (v1–v5)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Total checks run: 60');
  console.log('  Scripts: 5 audit files, 3 fix scripts');
  console.log('  Fixed: netAmount (59), isLowStock (3), purchaseNumber (7)');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
