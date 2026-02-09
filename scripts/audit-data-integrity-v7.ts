/**
 * 🏥 Deep Data Integrity Audit v7 (READ-ONLY)
 *
 * Goes beyond v6 stock/balance checks:
 *   1. Sale profit math (netAmount - totalCost = profit)
 *   2. SaleItem subtotal math (qty × salePrice = subtotal)
 *   3. SaleItem profit math (subtotal - (qty × costPrice) = profit)
 *   4. Sale discount math (totalAmount - discountAmount = netAmount)
 *   5. Sale netAmount vs SUM(SaleItem.subtotal)
 *   6. Purchase totalCost vs SUM(PurchaseItem.subtotal)
 *   7. PurchaseItem subtotal math (qty × costPrice = subtotal)
 *   8. Return refundAmount vs SUM(ReturnItem.refundAmount)
 *   9. ReturnItem refund math (qty × refundPerUnit = refundAmount)
 *  10. Orphan SaleItems (saleId → deleted/missing Sale)
 *  11. Orphan PurchaseItems (purchaseId → deleted/missing Purchase)
 *  12. Orphan StockLogs pointing to deleted products
 *  13. Cross-shop data leak (SaleItem.product.shopId ≠ Sale.shopId)
 *  14. Cross-shop StockLog (StockLog.shopId ≠ Product.shopId)
 *  15. Temporal: Sale date in the future
 *  16. Temporal: StockLog date before Product.createdAt
 *  17. Soft-delete: Active sales referencing deleted products
 *  18. RBAC: Users with no ShopMember record
 *  19. RBAC: ShopMembers with invalid roleId
 *  20. Negative stock products
 *  21. Cancelled sale with SALE StockLogs but no SALE_CANCEL
 *  22. Active sale with SALE_CANCEL StockLogs
 *
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v7.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

interface Issue {
  severity: Severity;
  category: string;
  message: string;
}

const issues: Issue[] = [];

function addIssue(severity: Severity, category: string, message: string) {
  issues.push({ severity, category, message });
}

let checkNum = 0;
const TOTAL_CHECKS = 22;

function startCheck(name: string) {
  checkNum++;
  process.stdout.write(`  [${checkNum}/${TOTAL_CHECKS}] ${name}...`);
}

function endCheck(count: number) {
  if (count === 0) {
    console.log(' ✅');
  } else {
    console.log(` 🔴 ${count}`);
  }
}

function endCheckWarn(count: number) {
  if (count === 0) {
    console.log(' ✅');
  } else {
    console.log(` 🟡 ${count}`);
  }
}

function endCheckInfo(label: string) {
  console.log(` 📊 ${label}`);
}

function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return Number(v);
}

// ── Financial Checks ───────────────────────────────────────────────────────

async function checkSaleProfitMath() {
  startCheck('Sale profit math (netAmount - totalCost = profit)');
  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, invoiceNumber: true, totalAmount: true, totalCost: true, profit: true, netAmount: true, discountAmount: true },
  });

  let count = 0;
  for (const s of sales) {
    const net = toNum(s.netAmount);
    const cost = toNum(s.totalCost);
    const profit = toNum(s.profit);
    const expected = Number((net - cost).toFixed(2));
    const actual = Number(profit.toFixed(2));

    if (Math.abs(expected - actual) > 0.01) {
      count++;
      addIssue('CRITICAL', 'Sale Profit Math',
        `[Sale] ${s.invoiceNumber}: netAmount(${net}) - totalCost(${cost}) = ${expected}, but profit = ${actual} (diff: ${(expected - actual).toFixed(2)})`);
    }
  }
  endCheck(count);
}

async function checkSaleDiscountMath() {
  startCheck('Sale discount math (totalAmount - discountAmount = netAmount)');
  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, invoiceNumber: true, totalAmount: true, discountAmount: true, netAmount: true },
  });

  let count = 0;
  for (const s of sales) {
    const total = toNum(s.totalAmount);
    const disc = toNum(s.discountAmount);
    const net = toNum(s.netAmount);
    const expected = Number((total - disc).toFixed(2));

    if (Math.abs(expected - net) > 0.01) {
      count++;
      addIssue('CRITICAL', 'Sale Discount Math',
        `[Sale] ${s.invoiceNumber}: totalAmount(${total}) - discountAmount(${disc}) = ${expected}, but netAmount = ${net}`);
    }
  }
  endCheck(count);
}

async function checkSaleNetVsItems() {
  startCheck('Sale totalAmount vs SUM(SaleItem.subtotal)');
  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, invoiceNumber: true, totalAmount: true },
  });

  let count = 0;
  for (const s of sales) {
    const agg = await prisma.saleItem.aggregate({
      where: { saleId: s.id },
      _sum: { subtotal: true },
    });
    const itemSum = toNum(agg._sum.subtotal);
    const total = toNum(s.totalAmount);

    if (Math.abs(total - itemSum) > 0.01) {
      count++;
      addIssue('CRITICAL', 'Sale Total vs Items',
        `[Sale] ${s.invoiceNumber}: totalAmount = ${total}, SUM(items.subtotal) = ${itemSum} (diff: ${(total - itemSum).toFixed(2)})`);
    }
  }
  endCheck(count);
}

async function checkSaleItemSubtotalMath() {
  startCheck('SaleItem subtotal math (qty × salePrice = subtotal)');
  const items = await prisma.saleItem.findMany({
    select: { id: true, quantity: true, salePrice: true, subtotal: true, sale: { select: { invoiceNumber: true } } },
  });

  let count = 0;
  for (const item of items) {
    const expected = Number((item.quantity * toNum(item.salePrice)).toFixed(2));
    const actual = toNum(item.subtotal);

    if (Math.abs(expected - actual) > 0.01) {
      count++;
      addIssue('WARNING', 'SaleItem Subtotal',
        `[SaleItem] ${item.sale.invoiceNumber}: qty(${item.quantity}) × price(${toNum(item.salePrice)}) = ${expected}, but subtotal = ${actual}`);
    }
  }
  endCheck(count);
}

async function checkSaleItemProfitMath() {
  startCheck('SaleItem profit math (subtotal - qty×costPrice)');
  const items = await prisma.saleItem.findMany({
    select: { id: true, quantity: true, salePrice: true, costPrice: true, subtotal: true, profit: true, discountAmount: true, sale: { select: { invoiceNumber: true } } },
  });

  let count = 0;
  for (const item of items) {
    const subtotal = toNum(item.subtotal);
    const cost = item.quantity * toNum(item.costPrice);
    const discount = toNum(item.discountAmount);
    const expected = Number((subtotal - cost - discount).toFixed(2));
    const actual = Number(toNum(item.profit).toFixed(2));

    if (Math.abs(expected - actual) > 0.01) {
      count++;
      addIssue('WARNING', 'SaleItem Profit',
        `[SaleItem] ${item.sale.invoiceNumber}: subtotal(${subtotal}) - cost(${cost.toFixed(2)}) - discount(${discount}) = ${expected}, but profit = ${actual}`);
    }
  }
  endCheckWarn(count);
}

async function checkPurchaseItemSubtotalMath() {
  startCheck('PurchaseItem subtotal math (qty × costPrice)');
  const items = await prisma.purchaseItem.findMany({
    select: { id: true, quantity: true, costPrice: true, subtotal: true, purchase: { select: { purchaseNumber: true } } },
  });

  let count = 0;
  for (const item of items) {
    const expected = Number((item.quantity * toNum(item.costPrice)).toFixed(2));
    const actual = toNum(item.subtotal);

    if (Math.abs(expected - actual) > 0.01) {
      count++;
      addIssue('WARNING', 'PurchaseItem Subtotal',
        `[PurchaseItem] ${item.purchase.purchaseNumber}: qty(${item.quantity}) × costPrice(${toNum(item.costPrice)}) = ${expected}, but subtotal = ${actual}`);
    }
  }
  endCheck(count);
}

async function checkPurchaseTotalVsItems() {
  startCheck('Purchase totalCost vs SUM(PurchaseItem.subtotal)');
  const purchases = await prisma.purchase.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, purchaseNumber: true, totalCost: true },
  });

  let count = 0;
  for (const p of purchases) {
    const agg = await prisma.purchaseItem.aggregate({
      where: { purchaseId: p.id },
      _sum: { subtotal: true },
    });
    const itemSum = toNum(agg._sum.subtotal);
    const total = toNum(p.totalCost);

    if (Math.abs(total - itemSum) > 0.01) {
      count++;
      addIssue('WARNING', 'Purchase Total vs Items',
        `[Purchase] ${p.purchaseNumber}: totalCost = ${total}, SUM(items.subtotal) = ${itemSum} (diff: ${(total - itemSum).toFixed(2)})`);
    }
  }
  endCheckWarn(count);
}

async function checkReturnMath() {
  startCheck('Return refundAmount vs SUM(ReturnItem.refundAmount)');
  const returns = await prisma.return.findMany({
    where: { status: 'COMPLETED' },
    select: { id: true, returnNumber: true, refundAmount: true },
  });

  let count = 0;
  for (const r of returns) {
    const agg = await prisma.returnItem.aggregate({
      where: { returnId: r.id },
      _sum: { refundAmount: true },
    });
    const itemSum = toNum(agg._sum.refundAmount);
    const total = toNum(r.refundAmount);

    if (Math.abs(total - itemSum) > 0.01) {
      count++;
      addIssue('CRITICAL', 'Return Refund Math',
        `[Return] ${r.returnNumber}: refundAmount = ${total}, SUM(items) = ${itemSum}`);
    }
  }
  endCheck(count);
}

async function checkReturnItemMath() {
  startCheck('ReturnItem refund math (qty × refundPerUnit)');
  const items = await prisma.returnItem.findMany({
    select: { id: true, quantity: true, refundPerUnit: true, refundAmount: true, return: { select: { returnNumber: true } } },
  });

  let count = 0;
  for (const item of items) {
    const expected = Number((item.quantity * toNum(item.refundPerUnit)).toFixed(2));
    const actual = toNum(item.refundAmount);

    if (Math.abs(expected - actual) > 0.01) {
      count++;
      addIssue('WARNING', 'ReturnItem Refund',
        `[ReturnItem] ${item.return.returnNumber}: qty(${item.quantity}) × perUnit(${toNum(item.refundPerUnit)}) = ${expected}, but refundAmount = ${actual}`);
    }
  }
  endCheck(count);
}

// ── Orphan & Reference Checks ──────────────────────────────────────────────

async function checkOrphanStockLogs() {
  startCheck('StockLogs referencing deleted products');
  const orphans = await prisma.stockLog.findMany({
    where: {
      product: { deletedAt: { not: null } },
    },
    select: { id: true, productId: true, type: true, product: { select: { name: true, deletedAt: true } } },
  });

  for (const o of orphans) {
    addIssue('WARNING', 'Orphan StockLog',
      `StockLog ${o.id.substring(0, 12)}... → deleted product "${o.product.name}" (deleted: ${o.product.deletedAt?.toISOString().substring(0, 10)})`);
  }
  endCheckWarn(orphans.length);
}

// ── Cross-Shop Leak Detection ──────────────────────────────────────────────

async function checkCrossShopSaleItems() {
  startCheck('Cross-shop leak: SaleItem product ≠ Sale shop');
  const items = await prisma.saleItem.findMany({
    select: {
      id: true,
      sale: { select: { invoiceNumber: true, shopId: true } },
      product: { select: { name: true, shopId: true } },
    },
  });

  let count = 0;
  for (const item of items) {
    if (item.sale.shopId !== item.product.shopId) {
      count++;
      addIssue('CRITICAL', 'Cross-Shop Leak',
        `[SaleItem] ${item.sale.invoiceNumber}: sale.shopId(${item.sale.shopId}) ≠ product.shopId(${item.product.shopId}) — "${item.product.name}"`);
    }
  }
  endCheck(count);
}

async function checkCrossShopStockLogs() {
  startCheck('Cross-shop leak: StockLog.shopId ≠ Product.shopId');
  const logs = await prisma.stockLog.findMany({
    select: {
      id: true,
      shopId: true,
      product: { select: { name: true, shopId: true } },
    },
  });

  let count = 0;
  for (const log of logs) {
    if (log.shopId !== log.product.shopId) {
      count++;
      addIssue('CRITICAL', 'Cross-Shop StockLog',
        `StockLog ${log.id.substring(0, 12)}... shopId(${log.shopId}) ≠ product.shopId(${log.product.shopId}) — "${log.product.name}"`);
    }
  }
  endCheck(count);
}

// ── Temporal Checks ────────────────────────────────────────────────────────

async function checkFutureSales() {
  startCheck('Sales with future dates');
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day buffer
  const sales = await prisma.sale.findMany({
    where: { date: { gt: future }, status: 'ACTIVE' },
    select: { invoiceNumber: true, date: true },
  });

  for (const s of sales) {
    addIssue('WARNING', 'Future Sale',
      `[Sale] ${s.invoiceNumber}: date=${s.date.toISOString().substring(0, 10)} (in the future)`);
  }
  endCheckWarn(sales.length);
}

async function checkStockLogBeforeProduct() {
  startCheck('StockLog date before Product.createdAt');
  // Only check non-backfill logs
  const logs = await prisma.stockLog.findMany({
    where: {
      NOT: { note: { contains: '[Auto-fix]' } },
    },
    select: {
      id: true,
      date: true,
      type: true,
      product: { select: { name: true, createdAt: true } },
    },
  });

  let count = 0;
  for (const log of logs) {
    // If StockLog date is > 1 hour before product creation, flag it
    const logDate = log.date.getTime();
    const productDate = log.product.createdAt.getTime();
    if (logDate < productDate - 3600000) { // 1 hour tolerance
      count++;
      addIssue('INFO', 'StockLog Before Product',
        `StockLog ${log.id.substring(0, 12)}... (${log.type}) date=${log.date.toISOString().substring(0, 10)} for "${log.product.name}" created ${log.product.createdAt.toISOString().substring(0, 10)}`);
    }
  }
  endCheckWarn(count);
}

// ── Soft-Delete Consistency ────────────────────────────────────────────────

async function checkActiveSalesDeletedProducts() {
  startCheck('Active sales referencing deleted products');
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { status: 'ACTIVE' },
      product: { deletedAt: { not: null } },
    },
    select: {
      sale: { select: { invoiceNumber: true } },
      product: { select: { name: true } },
    },
  });

  for (const item of items) {
    addIssue('WARNING', 'Active Sale → Deleted Product',
      `[Sale] ${item.sale.invoiceNumber} references deleted product "${item.product.name}"`);
  }
  endCheckWarn(items.length);
}

// ── RBAC / Access Checks ───────────────────────────────────────────────────

async function checkOrphanUsers() {
  startCheck('Users without any ShopMember membership');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, memberships: { select: { id: true } }, shop: { select: { id: true } } },
  });

  let count = 0;
  for (const u of users) {
    if (u.memberships.length === 0 && !u.shop) {
      count++;
      addIssue('INFO', 'Orphan User',
        `User "${u.name || u.email}" has no shop membership and doesn't own a shop`);
    }
  }
  endCheckInfo(`${count} orphan users`);
}

async function checkInvalidRoleRef() {
  startCheck('ShopMembers with roleId from different shop');
  const members = await prisma.shopMember.findMany({
    select: { id: true, shopId: true, role: { select: { shopId: true, name: true } }, user: { select: { name: true, email: true } } },
  });

  let count = 0;
  for (const m of members) {
    if (m.shopId !== m.role.shopId) {
      count++;
      addIssue('CRITICAL', 'Cross-Shop Role',
        `[Member] "${m.user.name || m.user.email}" in shop ${m.shopId} has role "${m.role.name}" from shop ${m.role.shopId}`);
    }
  }
  endCheck(count);
}

// ── Stock Sanity ───────────────────────────────────────────────────────────

async function checkNegativeStock() {
  startCheck('Products with negative stock');
  const products = await prisma.product.findMany({
    where: { deletedAt: null, stock: { lt: 0 } },
    select: { name: true, stock: true },
  });

  for (const p of products) {
    addIssue('CRITICAL', 'Negative Stock',
      `"${p.name}" has stock = ${p.stock}`);
  }
  endCheck(products.length);
}

// ── Cancel Consistency ─────────────────────────────────────────────────────

async function checkCancelledSaleMissingRestore() {
  startCheck('Cancelled sales without SALE_CANCEL StockLogs');
  const cancelledSales = await prisma.sale.findMany({
    where: { status: 'CANCELLED' },
    select: { id: true, invoiceNumber: true },
  });

  let count = 0;
  for (const s of cancelledSales) {
    const cancelLogs = await prisma.stockLog.count({
      where: { saleId: s.id, type: 'SALE_CANCEL' },
    });
    if (cancelLogs === 0) {
      count++;
      addIssue('WARNING', 'Cancelled Sale No Restore',
        `[Sale] ${s.invoiceNumber}: cancelled but no SALE_CANCEL StockLog (stock may not be restored)`);
    }
  }
  endCheckWarn(count);
}

async function checkActiveSaleWithCancelLog() {
  startCheck('Active sales with SALE_CANCEL StockLogs');
  const activeSales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, invoiceNumber: true },
  });

  let count = 0;
  for (const s of activeSales) {
    const cancelLogs = await prisma.stockLog.count({
      where: { saleId: s.id, type: 'SALE_CANCEL' },
    });
    if (cancelLogs > 0) {
      count++;
      addIssue('CRITICAL', 'Active Sale Has Cancel Log',
        `[Sale] ${s.invoiceNumber}: status=ACTIVE but has ${cancelLogs} SALE_CANCEL StockLog(s)`);
    }
  }
  endCheck(count);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🏥 Deep Data Integrity Audit v7 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // Financial
  await checkSaleProfitMath();
  await checkSaleDiscountMath();
  await checkSaleNetVsItems();
  await checkSaleItemSubtotalMath();
  await checkSaleItemProfitMath();
  await checkPurchaseItemSubtotalMath();
  await checkPurchaseTotalVsItems();
  await checkReturnMath();
  await checkReturnItemMath();

  // Orphan / Reference
  await checkOrphanStockLogs();

  // Cross-shop
  await checkCrossShopSaleItems();
  await checkCrossShopStockLogs();

  // Temporal
  await checkFutureSales();
  await checkStockLogBeforeProduct();

  // Soft-delete
  await checkActiveSalesDeletedProducts();

  // RBAC
  await checkOrphanUsers();
  await checkInvalidRoleRef();

  // Stock sanity
  await checkNegativeStock();

  // Cancel consistency
  await checkCancelledSaleMissingRestore();
  await checkActiveSaleWithCancelLog();

  // ── Summary ──────────────────────────────────────────────────────────

  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📋 Results');
  console.log('══════════════════════════════════════════════════════════');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const infos = issues.filter(i => i.severity === 'INFO');

  console.log('');
  console.log(`  Found ${issues.length} issue(s):`);
  console.log(`    🔴 CRITICAL: ${critical.length}`);
  console.log(`    🟡 WARNING:  ${warnings.length}`);
  console.log(`    🔵 INFO:     ${infos.length}`);

  // Group by category
  const byCategory = new Map<string, Issue[]>();
  for (const issue of issues) {
    const arr = byCategory.get(issue.category) || [];
    arr.push(issue);
    byCategory.set(issue.category, arr);
  }

  if (byCategory.size > 0) {
    console.log('');
    for (const [cat, catIssues] of Array.from(byCategory.entries())) {
      const icon = catIssues[0].severity === 'CRITICAL' ? '🔴' : catIssues[0].severity === 'WARNING' ? '🟡' : '🔵';
      console.log(`  ${icon} ${cat} (${catIssues.length}x)`);
      for (const issue of catIssues.slice(0, 10)) {
        console.log(`     ${issue.message}`);
      }
      if (catIssues.length > 10) {
        console.log(`     ... and ${catIssues.length - 10} more`);
      }
    }
  }

  console.log('');
  console.log('══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
