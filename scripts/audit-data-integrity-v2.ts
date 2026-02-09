/**
 * Deep Data Integrity Audit v2
 * 
 * ⚠️ READ-ONLY — never writes to the database.
 * 
 * Checks:
 *  1.  Orphaned SaleItems (no parent Sale)
 *  2.  Orphaned PurchaseItems (no parent Purchase)
 *  3.  Orphaned ReturnItems (no parent Return)
 *  4.  Orphaned StockLogs (referencing deleted/missing Sale/Purchase)
 *  5.  Cancelled Sales that still have un-restored stock
 *  6.  Cancelled Purchases with ghost stock
 *  7.  Sale with items referencing deleted products
 *  8.  Duplicate invoice numbers within the same shop
 *  9.  Product with negative stock
 * 10.  Customer/Supplier soft-deleted but still referenced by active sales/purchases
 * 11.  Sales with paymentStatus PENDING for too long (>7 days)
 * 12.  Deprecated field usage (customerName on Sale, supplierName on Purchase, category string)
 * 13.  Return refund amount vs sum of ReturnItem amounts
 * 14.  Shipment linked to cancelled Sale
 * 15.  isLowStock flag out of sync
 * 16.  Shop members without valid roles
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v2.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Issue {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  check: string;
  model: string;
  identifier: string;
  detail: string;
}

const issues: Issue[] = [];

function add(severity: Issue['severity'], check: string, model: string, identifier: string, detail: string) {
  issues.push({ severity, check, model, identifier, detail });
}

// ═══════════════════════════════════════════════════
// 1. Orphaned SaleItems
// ═══════════════════════════════════════════════════
async function check1_OrphanedSaleItems() {
  process.stdout.write('  [1/16]  Orphaned SaleItems...');
  const orphans = await prisma.saleItem.findMany({
    where: { sale: { is: null as any } },
    select: { id: true },
  }).catch(() => []);
  
  // Alternative: check if saleId references non-existing Sale
  const allItems = await prisma.saleItem.findMany({ select: { id: true, saleId: true } });
  const allSaleIds = new Set((await prisma.sale.findMany({ select: { id: true } })).map(s => s.id));
  
  let count = 0;
  for (const item of allItems) {
    if (!allSaleIds.has(item.saleId)) {
      add('CRITICAL', 'Orphan', 'SaleItem', item.id, `References non-existing Sale: ${item.saleId}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 2. Orphaned PurchaseItems
// ═══════════════════════════════════════════════════
async function check2_OrphanedPurchaseItems() {
  process.stdout.write('  [2/16]  Orphaned PurchaseItems...');
  const allItems = await prisma.purchaseItem.findMany({ select: { id: true, purchaseId: true } });
  const allPurchaseIds = new Set((await prisma.purchase.findMany({ select: { id: true } })).map(p => p.id));
  
  let count = 0;
  for (const item of allItems) {
    if (!allPurchaseIds.has(item.purchaseId)) {
      add('CRITICAL', 'Orphan', 'PurchaseItem', item.id, `References non-existing Purchase: ${item.purchaseId}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 3. Orphaned ReturnItems 
// ═══════════════════════════════════════════════════
async function check3_OrphanedReturnItems() {
  process.stdout.write('  [3/16]  Orphaned ReturnItems...');
  const allItems = await prisma.returnItem.findMany({ select: { id: true, returnId: true } });
  const allReturnIds = new Set((await prisma.return.findMany({ select: { id: true } })).map(r => r.id));
  
  let count = 0;
  for (const item of allItems) {
    if (!allReturnIds.has(item.returnId)) {
      add('CRITICAL', 'Orphan', 'ReturnItem', item.id, `References non-existing Return: ${item.returnId}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 4. Orphaned StockLogs (referencing deleted Sale/Purchase)
// ═══════════════════════════════════════════════════
async function check4_OrphanedStockLogs() {
  process.stdout.write('  [4/16]  Orphaned StockLogs...');
  const logs = await prisma.stockLog.findMany({
    select: { id: true, type: true, saleId: true, purchaseId: true, returnId: true, productId: true },
  });
  
  const saleIds = new Set((await prisma.sale.findMany({ select: { id: true } })).map(s => s.id));
  const purchaseIds = new Set((await prisma.purchase.findMany({ select: { id: true } })).map(p => p.id));
  const productIds = new Set((await prisma.product.findMany({ select: { id: true } })).map(p => p.id));
  
  let count = 0;
  for (const log of logs) {
    if (log.saleId && !saleIds.has(log.saleId)) {
      add('WARNING', 'Orphan StockLog', 'StockLog', log.id, `References deleted Sale: ${log.saleId}`);
      count++;
    }
    if (log.purchaseId && !purchaseIds.has(log.purchaseId)) {
      add('WARNING', 'Orphan StockLog', 'StockLog', log.id, `References deleted Purchase: ${log.purchaseId}`);
      count++;
    }
    if (!productIds.has(log.productId)) {
      add('CRITICAL', 'Orphan StockLog', 'StockLog', log.id, `References deleted Product: ${log.productId}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 5. Cancelled Sales — check stock was restored
// ═══════════════════════════════════════════════════
async function check5_CancelledSalesStock() {
  process.stdout.write('  [5/16]  Cancelled Sales stock restore...');
  const cancelledSales = await prisma.sale.findMany({
    where: { status: 'CANCELLED' },
    select: {
      id: true, invoiceNumber: true,
      items: { select: { productId: true, quantity: true } },
      stockLogs: { select: { type: true, quantity: true } },
    },
  });

  let count = 0;
  for (const sale of cancelledSales) {
    // Should have SALE_CANCEL logs that restore the stock
    const cancelLogs = sale.stockLogs.filter(l => l.type === 'SALE_CANCEL');
    const soldQty = sale.items.reduce((sum, i) => sum + i.quantity, 0);
    const restoredQty = cancelLogs.reduce((sum, l) => sum + l.quantity, 0);

    if (restoredQty < soldQty) {
      add('CRITICAL', 'Cancel Missing Restore', 'Sale', sale.invoiceNumber,
        `Cancelled but only ${restoredQty}/${soldQty} items restored to stock`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 6. Cancelled Purchases — check stock was reversed
// ═══════════════════════════════════════════════════
async function check6_CancelledPurchasesStock() {
  process.stdout.write('  [6/16]  Cancelled Purchases stock reverse...');
  const cancelledPurchases = await prisma.purchase.findMany({
    where: { status: 'CANCELLED' },
    select: {
      id: true, purchaseNumber: true,
      items: { select: { productId: true, quantity: true } },
      stockLogs: { select: { type: true, quantity: true } },
    },
  });

  let count = 0;
  for (const pur of cancelledPurchases) {
    const cancelLogs = pur.stockLogs.filter(l => l.type === 'PURCHASE_CANCEL');
    const boughtQty = pur.items.reduce((sum, i) => sum + i.quantity, 0);
    const reversedQty = Math.abs(cancelLogs.reduce((sum, l) => sum + l.quantity, 0));

    if (reversedQty < boughtQty) {
      add('CRITICAL', 'Cancel Missing Reverse', 'Purchase', pur.purchaseNumber || pur.id,
        `Cancelled but only ${reversedQty}/${boughtQty} items reversed from stock`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 7. SaleItems referencing soft-deleted products
// ═══════════════════════════════════════════════════
async function check7_DeletedProductRefs() {
  process.stdout.write('  [7/16]  Active sales with deleted products...');
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { status: { not: 'CANCELLED' } },
      product: { deletedAt: { not: null } },
    },
    select: {
      id: true,
      product: { select: { name: true } },
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const item of items) {
    add('WARNING', 'Deleted Product Ref', 'SaleItem', item.sale.invoiceNumber,
      `Active sale references deleted product: "${item.product.name}"`);
  }
  console.log(` ${items.length === 0 ? '✅' : `🟡 ${items.length}`}`);
}

// ═══════════════════════════════════════════════════
// 8. Duplicate invoice numbers within same shop
// ═══════════════════════════════════════════════════
async function check8_DuplicateInvoices() {
  process.stdout.write('  [8/16]  Duplicate invoice numbers...');
  const sales = await prisma.sale.findMany({
    select: { invoiceNumber: true, shopId: true, id: true },
    orderBy: { invoiceNumber: 'asc' },
  });

  const seen = new Map<string, number>();
  let count = 0;
  for (const s of sales) {
    const key = `${s.shopId}::${s.invoiceNumber}`;
    const prev = seen.get(key) || 0;
    seen.set(key, prev + 1);
    if (prev === 1) { // Report on second occurrence
      add('WARNING', 'Duplicate Invoice', 'Sale', s.invoiceNumber,
        `Duplicate invoice number in the same shop`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🟡 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 9. Products with negative stock
// ═══════════════════════════════════════════════════
async function check9_NegativeStock() {
  process.stdout.write('  [9/16]  Negative stock products...');
  const products = await prisma.product.findMany({
    where: { deletedAt: null, stock: { lt: 0 } },
    select: { name: true, stock: true },
  });

  for (const p of products) {
    add('CRITICAL', 'Negative Stock', 'Product', p.name, `stock = ${p.stock}`);
  }
  console.log(` ${products.length === 0 ? '✅' : `🔴 ${products.length}`}`);
}

// ═══════════════════════════════════════════════════
// 10. Deleted customer/supplier still linked to active records
// ═══════════════════════════════════════════════════
async function check10_DeletedEntityRefs() {
  process.stdout.write('  [10/16] Deleted customer/supplier in active records...');
  let count = 0;

  // Deleted customers with active sales
  const deletedCustomerSales = await prisma.sale.findMany({
    where: {
      status: { not: 'CANCELLED' },
      customer: { deletedAt: { not: null } },
    },
    select: { invoiceNumber: true, customer: { select: { name: true } } },
  });
  for (const s of deletedCustomerSales) {
    add('INFO', 'Deleted Entity Ref', 'Sale', s.invoiceNumber,
      `References deleted customer: "${s.customer?.name}"`);
    count++;
  }

  // Deleted suppliers with active purchases
  const deletedSupplierPurchases = await prisma.purchase.findMany({
    where: {
      status: { not: 'CANCELLED' },
      supplier: { deletedAt: { not: null } },
    },
    select: { id: true, purchaseNumber: true, supplier: { select: { name: true } } },
  });
  for (const p of deletedSupplierPurchases) {
    add('INFO', 'Deleted Entity Ref', 'Purchase', p.purchaseNumber || p.id,
      `References deleted supplier: "${p.supplier?.name}"`);
    count++;
  }
  console.log(` ${count === 0 ? '✅' : `🔵 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 11. Stale PENDING payments (>7 days old)
// ═══════════════════════════════════════════════════
async function check11_StalePendingPayments() {
  process.stdout.write('  [11/16] Stale PENDING payments (>7 days)...');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stale = await prisma.sale.findMany({
    where: {
      paymentStatus: 'PENDING',
      status: { not: 'CANCELLED' },
      date: { lt: sevenDaysAgo },
    },
    select: { invoiceNumber: true, date: true, netAmount: true },
  });

  for (const s of stale) {
    const days = Math.floor((Date.now() - s.date.getTime()) / (1000 * 60 * 60 * 24));
    add('WARNING', 'Stale Payment', 'Sale', s.invoiceNumber,
      `PENDING for ${days} days — ฿${toNumber(s.netAmount).toLocaleString()}`);
  }
  console.log(` ${stale.length === 0 ? '✅' : `🟡 ${stale.length}`}`);
}

// ═══════════════════════════════════════════════════
// 12. Deprecated field usage
// ═══════════════════════════════════════════════════
async function check12_DeprecatedFields() {
  process.stdout.write('  [12/16] Deprecated field usage...');
  let count = 0;

  // Sale.customerName without customerId
  const salesWithName = await prisma.sale.count({
    where: { customerName: { not: null }, customerId: null },
  });
  if (salesWithName > 0) {
    add('INFO', 'Deprecated Field', 'Sale', `${salesWithName} records`,
      `Using deprecated "customerName" without linked customerId`);
    count++;
  }

  // Purchase.supplierName without supplierId
  const purchasesWithName = await prisma.purchase.count({
    where: { supplierName: { not: null }, supplierId: null },
  });
  if (purchasesWithName > 0) {
    add('INFO', 'Deprecated Field', 'Purchase', `${purchasesWithName} records`,
      `Using deprecated "supplierName" without linked supplierId`);
    count++;
  }

  // Product using category string without categoryId
  const productsWithCategory = await prisma.product.count({
    where: { categoryId: null, deletedAt: null },
  });
  if (productsWithCategory > 0) {
    add('INFO', 'Deprecated Field', 'Product', `${productsWithCategory} records`,
      `Using deprecated "category" string without linked categoryId (LookupValue)`);
    count++;
  }

  console.log(` ${count === 0 ? '✅' : `🔵 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 13. Return refund amount vs ReturnItem sum
// ═══════════════════════════════════════════════════
async function check13_ReturnAmounts() {
  process.stdout.write('  [13/16] Return refund amounts...');
  const returns = await prisma.return.findMany({
    where: { status: 'COMPLETED' },
    select: {
      id: true, returnNumber: true, refundAmount: true,
      items: { select: { refundAmount: true } },
    },
  });

  let count = 0;
  for (const ret of returns) {
    const headerRefund = toNumber(ret.refundAmount);
    const itemsSum = ret.items.reduce((sum, i) => round2(sum + toNumber(i.refundAmount)), 0);
    if (Math.abs(headerRefund - itemsSum) > 0.01) {
      add('CRITICAL', 'Return Amount Mismatch', 'Return', ret.returnNumber,
        `Header refund ฿${headerRefund} ≠ items sum ฿${itemsSum}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 14. Shipment linked to cancelled Sale
// ═══════════════════════════════════════════════════
async function check14_ShipmentCancelledSale() {
  process.stdout.write('  [14/16] Shipments with cancelled sales...');
  const shipments = await prisma.shipment.findMany({
    where: {
      status: { not: 'CANCELLED' },
      sale: { status: 'CANCELLED' },
    },
    select: { shipmentNumber: true, sale: { select: { invoiceNumber: true } } },
  });

  for (const s of shipments) {
    add('WARNING', 'Shipment Cancelled Sale', 'Shipment', s.shipmentNumber,
      `Active shipment linked to cancelled sale: ${s.sale.invoiceNumber}`);
  }
  console.log(` ${shipments.length === 0 ? '✅' : `🟡 ${shipments.length}`}`);
}

// ═══════════════════════════════════════════════════
// 15. isLowStock flag out of sync
// ═══════════════════════════════════════════════════
async function check15_LowStockFlag() {
  process.stdout.write('  [15/16] isLowStock flag sync...');
  const products = await prisma.product.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true, stock: true, minStock: true, isLowStock: true },
  });

  let count = 0;
  for (const p of products) {
    const shouldBeLow = p.stock <= p.minStock;
    if (shouldBeLow !== p.isLowStock) {
      add('WARNING', 'LowStock Flag', 'Product', p.name,
        `isLowStock=${p.isLowStock} but stock=${p.stock} / minStock=${p.minStock} → should be ${shouldBeLow}`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🟡 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// 16. Shop members without valid roles
// ═══════════════════════════════════════════════════
async function check16_MembersWithoutRoles() {
  process.stdout.write('  [16/16] Members without valid roles...');
  const members = await prisma.shopMember.findMany({
    select: { id: true, userId: true, shopId: true, roleId: true },
  });
  const roleIds = new Set((await prisma.role.findMany({ select: { id: true } })).map(r => r.id));

  let count = 0;
  for (const m of members) {
    if (!roleIds.has(m.roleId)) {
      add('CRITICAL', 'Invalid Role', 'ShopMember', m.id,
        `Member has roleId="${m.roleId}" which doesn't exist`);
      count++;
    }
  }
  console.log(` ${count === 0 ? '✅' : `🔴 ${count}`}`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🏥 Deep Data Integrity Audit v2 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  await check1_OrphanedSaleItems();
  await check2_OrphanedPurchaseItems();
  await check3_OrphanedReturnItems();
  await check4_OrphanedStockLogs();
  await check5_CancelledSalesStock();
  await check6_CancelledPurchasesStock();
  await check7_DeletedProductRefs();
  await check8_DuplicateInvoices();
  await check9_NegativeStock();
  await check10_DeletedEntityRefs();
  await check11_StalePendingPayments();
  await check12_DeprecatedFields();
  await check13_ReturnAmounts();
  await check14_ShipmentCancelledSale();
  await check15_LowStockFlag();
  await check16_MembersWithoutRoles();

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
    console.log('  ✅ ALL 16 CHECKS PASSED — No issues found!\n');
  } else {
    console.log(`  Found ${issues.length} issue(s):`);
    console.log(`    🔴 CRITICAL: ${critical.length}`);
    console.log(`    🟡 WARNING:  ${warnings.length}`);
    console.log(`    🔵 INFO:     ${info.length}`);
    console.log('');

    // Group by check
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
      for (const issue of checkIssues.slice(0, 10)) {
        console.log(`     [${issue.model}] ${issue.identifier}: ${issue.detail}`);
      }
      if (checkIssues.length > 10) {
        console.log(`     ... and ${checkIssues.length - 10} more`);
      }
      console.log('');
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
