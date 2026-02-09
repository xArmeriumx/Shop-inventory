/**
 * Deep Data Integrity Audit v3
 * 
 * ⚠️ READ-ONLY — never writes to the database.
 * 
 * Checks:
 *  1.  Multi-tenant isolation (shopId consistency across related records)
 *  2.  StockLog balance chain (each log.balance == prev.balance + quantity)
 *  3.  Return quantity overflow (returned > sold)
 *  4.  Future dates (records dated in the future)
 *  5.  Zero/negative financial amounts
 *  6.  Pricing anomalies (costPrice > salePrice, or salePrice = 0)
 *  7.  SaleItem vs Product price snapshot drift
 *  8.  Expense/Income with amount = 0
 *  9.  Notification orphans (expired or unlinked)
 * 10.  SystemLog error analysis
 * 11.  Customer address orphans
 * 12.  Shipment without items (sale has 0 active items)
 * 13.  Sale profit recalculation verification
 * 14.  PurchaseItem subtotal verification (qty * costPrice = subtotal)
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v3.ts
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
// 1. Multi-tenant shopId isolation
// ═══════════════════════════════════════════════════
async function check1_ShopIsolation() {
  process.stdout.write('  [1/14]  Shop isolation (cross-tenant leaks)...');
  let count = 0;

  // Sale items must belong to products from the same shop
  const sales = await prisma.sale.findMany({
    select: {
      id: true, invoiceNumber: true, shopId: true,
      items: { select: { product: { select: { shopId: true, name: true } } } },
    },
  });
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.product.shopId !== sale.shopId) {
        add('CRITICAL', 'Shop Isolation', 'Sale', sale.invoiceNumber,
          `Product "${item.product.name}" belongs to shop ${item.product.shopId} but sale is in shop ${sale.shopId}`);
        count++;
      }
    }
  }

  // Purchase items from products in same shop
  const purchases = await prisma.purchase.findMany({
    select: {
      id: true, purchaseNumber: true, shopId: true,
      items: { select: { product: { select: { shopId: true, name: true } } } },
    },
  });
  for (const pur of purchases) {
    for (const item of pur.items) {
      if (item.product.shopId !== pur.shopId) {
        add('CRITICAL', 'Shop Isolation', 'Purchase', pur.purchaseNumber || pur.id,
          `Product "${item.product.name}" belongs to different shop`);
        count++;
      }
    }
  }

  // StockLogs must match product's shop
  const logs = await prisma.stockLog.findMany({
    select: { id: true, shopId: true, product: { select: { shopId: true, name: true } } },
  });
  for (const log of logs) {
    if (log.shopId !== log.product.shopId) {
      add('CRITICAL', 'Shop Isolation', 'StockLog', log.id,
        `Log shopId=${log.shopId} ≠ product shopId=${log.product.shopId}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 2. StockLog balance chain integrity
// ═══════════════════════════════════════════════════
async function check2_BalanceChain() {
  process.stdout.write('  [2/14]  StockLog balance chain...');
  let count = 0;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true },
  });

  for (const prod of products) {
    const logs = await prisma.stockLog.findMany({
      where: { productId: prod.id },
      orderBy: { date: 'asc' },
      select: { id: true, quantity: true, balance: true, date: true, type: true },
    });

    if (logs.length === 0) continue;

    // Check chain: each entry's balance should == prev balance + quantity
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const expected = prev.balance + curr.quantity;
      if (curr.balance !== expected) {
        add('WARNING', 'Balance Chain Break', 'StockLog', prod.name,
          `Entry ${i + 1}/${logs.length}: expected balance=${expected} (${prev.balance}+${curr.quantity}) but got ${curr.balance}`);
        count++;
        break; // Only report first break per product
      }
    }

    // Check last log balance matches current product stock
    const lastLog = logs[logs.length - 1];
    if (lastLog.balance !== prod.stock) {
      add('WARNING', 'Balance Trail Drift', 'StockLog', prod.name,
        `Last log balance=${lastLog.balance} ≠ Product.stock=${prod.stock}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 3. Return quantity overflow
// ═══════════════════════════════════════════════════
async function check3_ReturnOverflow() {
  process.stdout.write('  [3/14]  Return quantity overflow...');
  let count = 0;

  const returnItems = await prisma.returnItem.findMany({
    select: {
      id: true, quantity: true,
      saleItem: { select: { quantity: true, sale: { select: { invoiceNumber: true } } } },
      product: { select: { name: true } },
      return: { select: { returnNumber: true, status: true } },
    },
  });

  // Group returns by saleItemId to check total returned
  const saleItemReturns = new Map<string, { returned: number; saleQty: number; invoice: string; product: string }>();

  const allReturnItems = await prisma.returnItem.findMany({
    select: {
      saleItemId: true, quantity: true,
      saleItem: { select: { quantity: true, sale: { select: { invoiceNumber: true } } } },
      product: { select: { name: true } },
      return: { select: { status: true } },
    },
  });

  for (const ri of allReturnItems) {
    if (ri.return.status === 'CANCELLED') continue;
    const existing = saleItemReturns.get(ri.saleItemId);
    if (existing) {
      existing.returned += ri.quantity;
    } else {
      saleItemReturns.set(ri.saleItemId, {
        returned: ri.quantity,
        saleQty: ri.saleItem.quantity,
        invoice: ri.saleItem.sale.invoiceNumber,
        product: ri.product.name,
      });
    }
  }

  for (const [saleItemId, data] of Array.from(saleItemReturns)) {
    if (data.returned > data.saleQty) {
      add('CRITICAL', 'Return Overflow', 'ReturnItem', data.invoice,
        `"${data.product}": returned ${data.returned} but only sold ${data.saleQty}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 4. Future dates
// ═══════════════════════════════════════════════════
async function check4_FutureDates() {
  process.stdout.write('  [4/14]  Future dates...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  let count = 0;

  const futureSales = await prisma.sale.count({ where: { date: { gt: tomorrow } } });
  if (futureSales > 0) {
    add('WARNING', 'Future Date', 'Sale', `${futureSales} records`, `Sales dated in the future`);
    count++;
  }

  const futurePurchases = await prisma.purchase.count({ where: { date: { gt: tomorrow } } });
  if (futurePurchases > 0) {
    add('WARNING', 'Future Date', 'Purchase', `${futurePurchases} records`, `Purchases dated in the future`);
    count++;
  }

  const futureExpenses = await prisma.expense.count({ where: { date: { gt: tomorrow }, deletedAt: null } });
  if (futureExpenses > 0) {
    add('WARNING', 'Future Date', 'Expense', `${futureExpenses} records`, `Expenses dated in the future`);
    count++;
  }

  const futureIncomes = await prisma.income.count({ where: { date: { gt: tomorrow }, deletedAt: null } });
  if (futureIncomes > 0) {
    add('WARNING', 'Future Date', 'Income', `${futureIncomes} records`, `Incomes dated in the future`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 5. Zero/negative financial amounts
// ═══════════════════════════════════════════════════
async function check5_ZeroNegativeAmounts() {
  process.stdout.write('  [5/14]  Zero/negative amounts...');
  let count = 0;

  // Active sales with 0 total
  const zeroSales = await prisma.sale.findMany({
    where: { status: 'ACTIVE', totalAmount: { lte: 0 } },
    select: { invoiceNumber: true, totalAmount: true },
  });
  for (const s of zeroSales) {
    add('WARNING', 'Zero Amount', 'Sale', s.invoiceNumber,
      `Active sale with totalAmount = ฿${toNum(s.totalAmount)}`);
    count++;
  }

  // Active purchases with 0 total
  const zeroPurchases = await prisma.purchase.findMany({
    where: { status: 'ACTIVE', totalCost: { lte: 0 } },
    select: { id: true, purchaseNumber: true, totalCost: true },
  });
  for (const p of zeroPurchases) {
    add('WARNING', 'Zero Amount', 'Purchase', p.purchaseNumber || p.id,
      `Active purchase with totalCost = ฿${toNum(p.totalCost)}`);
    count++;
  }

  // Expenses with 0
  const zeroExpenses = await prisma.expense.count({ where: { amount: { lte: 0 }, deletedAt: null } });
  if (zeroExpenses > 0) {
    add('WARNING', 'Zero Amount', 'Expense', `${zeroExpenses} records`, `Expenses with amount ≤ 0`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 6. Pricing anomalies
// ═══════════════════════════════════════════════════
async function check6_PricingAnomalies() {
  process.stdout.write('  [6/14]  Pricing anomalies...');
  let count = 0;

  const products = await prisma.product.findMany({
    where: { deletedAt: null, isActive: true },
    select: { name: true, costPrice: true, salePrice: true },
  });

  for (const p of products) {
    const cost = toNum(p.costPrice);
    const sale = toNum(p.salePrice);

    if (sale === 0) {
      add('WARNING', 'Pricing', 'Product', p.name, `salePrice = ฿0`);
      count++;
    } else if (cost > sale) {
      add('INFO', 'Pricing', 'Product', p.name,
        `costPrice (฿${cost}) > salePrice (฿${sale}) → negative margin`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 7. SaleItem price snapshot vs current Product price
// ═══════════════════════════════════════════════════
async function check7_PriceDrift() {
  process.stdout.write('  [7/14]  Price drift (item snapshot vs current)...');
  let count = 0;

  const items = await prisma.saleItem.findMany({
    where: { sale: { status: 'ACTIVE' } },
    select: {
      salePrice: true, costPrice: true,
      product: { select: { name: true, salePrice: true, costPrice: true } },
      sale: { select: { invoiceNumber: true, date: true } },
    },
    orderBy: { sale: { date: 'desc' } },
    take: 200, // Only check recent
  });

  let driftCount = 0;
  for (const item of items) {
    const itemSale = toNum(item.salePrice);
    const currentSale = toNum(item.product.salePrice);
    const pctDiff = currentSale > 0 ? Math.abs((itemSale - currentSale) / currentSale * 100) : 0;
    
    if (pctDiff > 50 && Math.abs(itemSale - currentSale) > 100) {
      driftCount++;
      if (driftCount <= 5) { // Only report first 5
        add('INFO', 'Price Drift', 'SaleItem', item.sale.invoiceNumber,
          `"${item.product.name}" sold at ฿${itemSale} but current price ฿${currentSale} (${pctDiff.toFixed(0)}% diff)`);
      }
    }
  }
  if (driftCount > 5) {
    add('INFO', 'Price Drift', 'SaleItem', `${driftCount - 5} more`, `Additional price drifts found`);
  }
  count = driftCount;

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 8. Expense/Income with zero amount
// ═══════════════════════════════════════════════════
async function check8_ZeroExpenseIncome() {
  process.stdout.write('  [8/14]  Zero expense/income amounts...');
  let count = 0;

  const zeroExpenses = await prisma.expense.count({ where: { amount: 0, deletedAt: null } });
  if (zeroExpenses > 0) {
    add('WARNING', 'Zero Expense', 'Expense', `${zeroExpenses} records`, `Expenses with amount = ฿0`);
    count++;
  }

  const zeroIncomes = await prisma.income.count({ where: { amount: 0, deletedAt: null } });
  if (zeroIncomes > 0) {
    add('WARNING', 'Zero Income', 'Income', `${zeroIncomes} records`, `Incomes with amount = ฿0`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 9. Expired/orphan notifications
// ═══════════════════════════════════════════════════
async function check9_Notifications() {
  process.stdout.write('  [9/14]  Notification health...');
  let count = 0;

  // Expired but unread
  const expiredUnread = await prisma.notification.count({
    where: { expiresAt: { lt: new Date() }, isRead: false },
  });
  if (expiredUnread > 0) {
    add('INFO', 'Expired Notifications', 'Notification', `${expiredUnread} records`,
      `Expired notifications that were never read`);
    count++;
  }

  // Total unread
  const totalUnread = await prisma.notification.count({ where: { isRead: false } });
  if (totalUnread > 50) {
    add('INFO', 'Unread Notifications', 'Notification', `${totalUnread} records`,
      `Large backlog of unread notifications`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 10. SystemLog error analysis
// ═══════════════════════════════════════════════════
async function check10_SystemErrors() {
  process.stdout.write('  [10/14] SystemLog errors...');
  
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const errorCount = await prisma.systemLog.count({
    where: { level: 'ERROR', createdAt: { gte: last7Days } },
  });
  const warnCount = await prisma.systemLog.count({
    where: { level: 'WARN', createdAt: { gte: last7Days } },
  });

  if (errorCount > 0) {
    add('WARNING', 'System Errors', 'SystemLog', `${errorCount} errors`,
      `${errorCount} errors in the last 7 days`);

    // Show top 3 error messages
    const topErrors = await prisma.systemLog.findMany({
      where: { level: 'ERROR', createdAt: { gte: last7Days } },
      select: { message: true, path: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    for (const err of topErrors) {
      add('INFO', 'Recent Error', 'SystemLog', err.path || 'unknown',
        err.message.substring(0, 120));
    }
  }
  if (warnCount > 10) {
    add('INFO', 'System Warnings', 'SystemLog', `${warnCount} warnings`,
      `${warnCount} warnings in the last 7 days`);
  }

  console.log(errorCount === 0 ? ' ✅' : ` 🟡 ${errorCount} errors / ${warnCount} warns`);
}

// ═══════════════════════════════════════════════════
// 11. Customer address orphans
// ═══════════════════════════════════════════════════
async function check11_AddressOrphans() {
  process.stdout.write('  [11/14] Customer address orphans...');
  let count = 0;

  // Addresses for deleted customers
  const orphanAddresses = await prisma.customerAddress.findMany({
    where: { customer: { deletedAt: { not: null } }, deletedAt: null },
    select: { id: true, customer: { select: { name: true } } },
  });

  if (orphanAddresses.length > 0) {
    add('INFO', 'Address Orphan', 'CustomerAddress', `${orphanAddresses.length} records`,
      `Active addresses belonging to deleted customers`);
    count++;
  }

  // Multiple default addresses for same customer
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true,
      addresses: { where: { isDefault: true, deletedAt: null }, select: { id: true } },
    },
  });
  for (const c of customers) {
    if (c.addresses.length > 1) {
      add('WARNING', 'Multiple Defaults', 'CustomerAddress', c.name,
        `Customer has ${c.addresses.length} default addresses`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 12. Shipments for cancelled sales
// ═══════════════════════════════════════════════════
async function check12_ShipmentIntegrity() {
  process.stdout.write('  [12/14] Shipment data integrity...');
  let count = 0;

  // Delivered shipments without tracking
  const noTracking = await prisma.shipment.count({
    where: { status: 'SHIPPED', trackingNumber: null },
  });
  if (noTracking > 0) {
    add('WARNING', 'Missing Tracking', 'Shipment', `${noTracking} records`,
      `Shipped items without tracking number`);
    count++;
  }

  // Shipments with shippingCost = 0
  const freeship = await prisma.shipment.count({
    where: { shippingCost: 0, status: { not: 'CANCELLED' } },
  });
  if (freeship > 0) {
    add('INFO', 'Free Shipping', 'Shipment', `${freeship} records`,
      `Active shipments with ฿0 shipping cost`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 13. Sale profit recalculation
// ═══════════════════════════════════════════════════
async function check13_ProfitRecalc() {
  process.stdout.write('  [13/14] Sale profit recalculation...');
  let count = 0;

  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true, totalAmount: true, totalCost: true,
      profit: true, discountAmount: true, netAmount: true,
    },
  });

  for (const s of sales) {
    const total = toNum(s.totalAmount);
    const cost = toNum(s.totalCost);
    const discount = toNum(s.discountAmount);
    const net = toNum(s.netAmount);
    const profit = toNum(s.profit);

    // Check: netAmount = totalAmount - discountAmount
    const expectedNet = Math.round((total - discount) * 100) / 100;
    if (Math.abs(net - expectedNet) > 0.01) {
      add('CRITICAL', 'Net Amount', 'Sale', s.invoiceNumber,
        `netAmount ฿${net} ≠ totalAmount ฿${total} - discount ฿${discount} = ฿${expectedNet}`);
      count++;
    }

    // Check: profit = netAmount - totalCost
    const expectedProfit = Math.round((net - cost) * 100) / 100;
    if (Math.abs(profit - expectedProfit) > 0.01) {
      add('CRITICAL', 'Profit Calc', 'Sale', s.invoiceNumber,
        `profit ฿${profit} ≠ netAmount ฿${net} - cost ฿${cost} = ฿${expectedProfit}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 14. PurchaseItem subtotal verification
// ═══════════════════════════════════════════════════
async function check14_PurchaseItemMath() {
  process.stdout.write('  [14/14] PurchaseItem subtotal math...');
  let count = 0;

  const items = await prisma.purchaseItem.findMany({
    select: {
      id: true, quantity: true, costPrice: true, subtotal: true,
      purchase: { select: { purchaseNumber: true } },
      product: { select: { name: true } },
    },
  });

  for (const item of items) {
    const expected = Math.round(item.quantity * toNum(item.costPrice) * 100) / 100;
    const actual = toNum(item.subtotal);
    if (Math.abs(actual - expected) > 0.01) {
      add('CRITICAL', 'PurchaseItem Math', 'PurchaseItem', item.purchase.purchaseNumber || item.id,
        `"${item.product.name}": ${item.quantity} × ฿${toNum(item.costPrice)} = ฿${expected} but subtotal = ฿${actual}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🔬 Deep Data Integrity Audit v3 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  await check1_ShopIsolation();
  await check2_BalanceChain();
  await check3_ReturnOverflow();
  await check4_FutureDates();
  await check5_ZeroNegativeAmounts();
  await check6_PricingAnomalies();
  await check7_PriceDrift();
  await check8_ZeroExpenseIncome();
  await check9_Notifications();
  await check10_SystemErrors();
  await check11_AddressOrphans();
  await check12_ShipmentIntegrity();
  await check13_ProfitRecalc();
  await check14_PurchaseItemMath();

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
    console.log('  ✅ ALL 14 CHECKS PASSED — No issues found!\n');
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

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
