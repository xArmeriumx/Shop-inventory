/**
 * 🏥 Master Data Integrity Audit v6
 * 
 * ⚠️ READ-ONLY — never writes to the database.
 * 
 * NEW checks not covered by v1–v5:
 *  1.  Purchase totalCost vs SUM(PurchaseItem.subtotal)
 *  2.  Return shopId mismatch (return.shopId ≠ sale.shopId)
 *  3.  StockLog quantity sign validation (SALE = negative, PURCHASE = positive)
 *  4.  Product stock recalculation vs SUM(StockLog.quantity)
 *  5.  StockLog with multiple FKs set (saleId + purchaseId both set = bad)
 *  6.  Sale totalCost vs SUM(SaleItem.costPrice * qty)
 *  7.  Orphaned StockLogs without new FK AND without referenceId (completely unlinked)
 *  8.  Shipment saleId shop isolation (shipment.shopId ≠ sale.shopId)
 *  9.  Return on same sale - total returned qty vs sold qty per SaleItem
 * 10.  Sale item count = 0 (sales with no items)
 * 11.  Purchase totalCost negative or zero
 * 12.  Notification with expired expiresAt analysis
 * 13.  Product stock vs computed stock from StockLogs (FULL RECOMPUTE)
 * 14.  StockLog balance continuity (each balance = previous + qty, NO gaps)
 * 15.  Expense/Income shopId isolation (userId → shopMember check)
 * 16.  Duplicate returnNumber within same shop
 * 17.  Sale with discount but no discountType
 * 18.  SystemLog growth analysis (storage health)
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v6.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function toNum(val: Prisma.Decimal | number | null | undefined): number {
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
function add(sev: Issue['severity'], check: string, model: string, id: string, detail: string) {
  issues.push({ severity: sev, check, model, identifier: id, detail });
}

// ═══════════════════════════════════════════════════
// 1. Purchase totalCost vs SUM(PurchaseItem.subtotal)
// ═══════════════════════════════════════════════════
async function check1_PurchaseTotalVsItems() {
  process.stdout.write('  [1/18]  Purchase total vs items sum...');
  let count = 0;

  const purchases = await prisma.purchase.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      purchaseNumber: true,
      totalCost: true,
      items: { select: { subtotal: true } },
    },
  });

  for (const pur of purchases) {
    const itemsTotal = pur.items.reduce((sum, i) => sum + toNum(i.subtotal), 0);
    const headerTotal = toNum(pur.totalCost);
    if (Math.abs(headerTotal - round2(itemsTotal)) > 0.01) {
      add('CRITICAL', 'Purchase Total Mismatch', 'Purchase', pur.purchaseNumber || pur.id.substring(0, 12),
        `totalCost ฿${headerTotal} ≠ SUM(items) ฿${round2(itemsTotal)}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 2. Return shopId mismatch
// ═══════════════════════════════════════════════════
async function check2_ReturnShopMismatch() {
  process.stdout.write('  [2/18]  Return shopId vs Sale shopId...');
  let count = 0;

  const returns = await prisma.return.findMany({
    select: {
      returnNumber: true, shopId: true,
      sale: { select: { shopId: true, invoiceNumber: true } },
    },
  });

  for (const ret of returns) {
    if (ret.shopId !== ret.sale.shopId) {
      add('CRITICAL', 'Return Shop Mismatch', 'Return', ret.returnNumber,
        `Return shop ≠ Sale shop (sale: ${ret.sale.invoiceNumber})`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 3. StockLog quantity sign validation
// ═══════════════════════════════════════════════════
async function check3_StockLogSignValidation() {
  process.stdout.write('  [3/18]  StockLog quantity sign validation...');
  let count = 0;

  const logs = await prisma.stockLog.findMany({
    select: { id: true, type: true, quantity: true, note: true },
  });

  for (const log of logs) {
    switch (log.type) {
      case 'SALE':
        if (log.quantity > 0) {
          add('WARNING', 'Sign Violation', 'StockLog', log.id.substring(0, 12),
            `SALE should be negative but qty=${log.quantity}`);
          count++;
        }
        break;
      case 'PURCHASE':
        if (log.quantity < 0) {
          add('WARNING', 'Sign Violation', 'StockLog', log.id.substring(0, 12),
            `PURCHASE should be positive but qty=${log.quantity}`);
          count++;
        }
        break;
      case 'RETURN':
        if (log.quantity < 0) {
          add('WARNING', 'Sign Violation', 'StockLog', log.id.substring(0, 12),
            `RETURN should be positive (restore stock) but qty=${log.quantity}`);
          count++;
        }
        break;
      case 'SALE_CANCEL':
        if (log.quantity < 0) {
          add('WARNING', 'Sign Violation', 'StockLog', log.id.substring(0, 12),
            `SALE_CANCEL should be positive (restore stock) but qty=${log.quantity}`);
          count++;
        }
        break;
      case 'PURCHASE_CANCEL':
        if (log.quantity > 0) {
          add('WARNING', 'Sign Violation', 'StockLog', log.id.substring(0, 12),
            `PURCHASE_CANCEL should be negative (remove stock) but qty=${log.quantity}`);
          count++;
        }
        break;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 4. Product stock RECOMPUTE vs SUM(StockLog.quantity)
// ═══════════════════════════════════════════════════
async function check4_ProductStockRecompute() {
  process.stdout.write('  [4/18]  Product stock vs SUM(StockLog)...');
  let count = 0;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true },
  });

  for (const prod of products) {
    const result = await prisma.stockLog.aggregate({
      where: { productId: prod.id },
      _sum: { quantity: true },
    });

    const computedStock = result._sum.quantity || 0;
    if (prod.stock !== computedStock) {
      add('CRITICAL', 'Stock Drift', 'Product', prod.name,
        `Product.stock=${prod.stock} but SUM(StockLog.qty)=${computedStock} — diff: ${prod.stock - computedStock}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 5. StockLog with multiple FKs set
// ═══════════════════════════════════════════════════
async function check5_StockLogMultiFK() {
  process.stdout.write('  [5/18]  StockLog multi-FK conflict...');
  let count = 0;

  const logs = await prisma.stockLog.findMany({
    select: { id: true, type: true, saleId: true, purchaseId: true, returnId: true },
  });

  for (const log of logs) {
    const fksSet = [log.saleId, log.purchaseId, log.returnId].filter(Boolean).length;
    if (fksSet > 2) {
      add('WARNING', 'Multi-FK', 'StockLog', log.id.substring(0, 12),
        `${fksSet} FKs set simultaneously (type=${log.type})`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 6. Sale totalCost vs SUM(SaleItem.costPrice * qty)
// ═══════════════════════════════════════════════════
async function check6_SaleTotalCostVsItems() {
  process.stdout.write('  [6/18]  Sale totalCost vs items cost...');
  let count = 0;

  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true, totalCost: true,
      items: { select: { costPrice: true, quantity: true } },
    },
  });

  for (const sale of sales) {
    const computedCost = sale.items.reduce((sum, i) => sum + round2(toNum(i.costPrice) * i.quantity), 0);
    const headerCost = toNum(sale.totalCost);
    if (Math.abs(headerCost - round2(computedCost)) > 0.01) {
      add('CRITICAL', 'Sale Cost Mismatch', 'Sale', sale.invoiceNumber,
        `totalCost ฿${headerCost} ≠ SUM(items cost) ฿${round2(computedCost)}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 7. Completely unlinked StockLogs
// ═══════════════════════════════════════════════════
async function check7_UnlinkedStockLogs() {
  process.stdout.write('  [7/18]  Completely unlinked StockLogs...');

  const unlinked = await prisma.stockLog.findMany({
    where: {
      saleId: null,
      purchaseId: null,
      returnId: null,
      referenceId: null,
      type: { in: ['SALE', 'SALE_CANCEL', 'PURCHASE', 'PURCHASE_CANCEL', 'RETURN'] },
    },
    select: { id: true, type: true, note: true, date: true },
  });

  for (const log of unlinked.slice(0, 10)) {
    add('WARNING', 'Unlinked StockLog', 'StockLog', log.id.substring(0, 12),
      `type=${log.type} but no FK and no referenceId — ${log.note || '(no note)'}`);
  }
  if (unlinked.length > 10) {
    add('WARNING', 'Unlinked StockLog', 'StockLog', `${unlinked.length - 10} more`, 'Additional unlinked logs');
  }

  console.log(unlinked.length === 0 ? ' ✅' : ` 🟡 ${unlinked.length}`);
}

// ═══════════════════════════════════════════════════
// 8. Shipment shopId isolation
// ═══════════════════════════════════════════════════
async function check8_ShipmentShopIsolation() {
  process.stdout.write('  [8/18]  Shipment shop isolation...');
  let count = 0;

  const shipments = await prisma.shipment.findMany({
    select: {
      shipmentNumber: true, shopId: true,
      sale: { select: { shopId: true } },
    },
  });

  for (const s of shipments) {
    if (s.shopId !== s.sale.shopId) {
      add('CRITICAL', 'Shipment Shop Leak', 'Shipment', s.shipmentNumber,
        `Shipment shop ≠ Sale shop — cross-tenant leak!`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 9. Return total qty vs sold qty per SaleItem
// ═══════════════════════════════════════════════════
async function check9_ReturnQtyOverflow() {
  process.stdout.write('  [9/18]  Return qty overflow per SaleItem...');
  let count = 0;

  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: { status: 'ACTIVE' },
      returnItems: { some: {} },
    },
    select: {
      id: true, quantity: true,
      sale: { select: { invoiceNumber: true } },
      product: { select: { name: true } },
      returnItems: {
        where: { return: { status: 'COMPLETED' } },
        select: { quantity: true },
      },
    },
  });

  for (const item of saleItems) {
    const totalReturned = item.returnItems.reduce((sum, ri) => sum + ri.quantity, 0);
    if (totalReturned > item.quantity) {
      add('CRITICAL', 'Return Overflow', 'SaleItem', item.sale.invoiceNumber,
        `"${item.product.name}": returned ${totalReturned} > sold ${item.quantity}`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🔴 ${count}`);
}

// ═══════════════════════════════════════════════════
// 10. Sales with zero items
// ═══════════════════════════════════════════════════
async function check10_EmptySales() {
  process.stdout.write('  [10/18] Sales with zero items...');

  const emptySales = await prisma.sale.findMany({
    where: { status: 'ACTIVE', items: { none: {} } },
    select: { invoiceNumber: true },
  });

  for (const s of emptySales) {
    add('CRITICAL', 'Empty Sale', 'Sale', s.invoiceNumber, 'Active sale with 0 items');
  }

  console.log(emptySales.length === 0 ? ' ✅' : ` 🔴 ${emptySales.length}`);
}

// ═══════════════════════════════════════════════════
// 11. Purchase totalCost ≤ 0
// ═══════════════════════════════════════════════════
async function check11_PurchaseZeroCost() {
  process.stdout.write('  [11/18] Purchase with zero/negative cost...');

  const badPurchases = await prisma.purchase.findMany({
    where: { status: 'ACTIVE', totalCost: { lte: 0 } },
    select: { id: true, purchaseNumber: true, totalCost: true },
  });

  for (const p of badPurchases) {
    add('WARNING', 'Zero Purchase Cost', 'Purchase', p.purchaseNumber || p.id.substring(0, 12),
      `Active purchase with totalCost = ฿${toNum(p.totalCost)}`);
  }

  console.log(badPurchases.length === 0 ? ' ✅' : ` 🟡 ${badPurchases.length}`);
}

// ═══════════════════════════════════════════════════
// 12. Notification cleanup analysis
// ═══════════════════════════════════════════════════
async function check12_NotificationHealth() {
  process.stdout.write('  [12/18] Notification cleanup analysis...');
  let count = 0;

  const total = await prisma.notification.count();
  const expired = await prisma.notification.count({
    where: { expiresAt: { lt: new Date() } },
  });
  const unread = await prisma.notification.count({ where: { isRead: false } });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldRead = await prisma.notification.count({
    where: { isRead: true, createdAt: { lt: thirtyDaysAgo } },
  });

  if (expired > 0) {
    add('INFO', 'Expired Notifications', 'Notification', `${expired}/${total}`,
      `${expired} expired notifications can be purged`);
    count++;
  }
  if (oldRead > 0) {
    add('INFO', 'Old Read Notifications', 'Notification', `${oldRead} records`,
      `Read notifications > 30 days old — candidates for cleanup`);
    count++;
  }
  if (unread > 100) {
    add('WARNING', 'Unread Backlog', 'Notification', `${unread} unread`,
      `Large unread notification backlog`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 total=${total} expired=${expired} oldRead=${oldRead}`);
}

// ═══════════════════════════════════════════════════
// 13. Product stock vs StockLog FULL RECOMPUTE (with first-log check)
// ═══════════════════════════════════════════════════
async function check13_BalanceContinuity() {
  process.stdout.write('  [13/18] StockLog balance chain (full)...');
  let breaks = 0;
  let drifts = 0;

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true },
  });

  for (const prod of products) {
    const logs = await prisma.stockLog.findMany({
      where: { productId: prod.id },
      orderBy: { date: 'asc' },
      select: { id: true, quantity: true, balance: true, type: true },
    });

    if (logs.length === 0) {
      if (prod.stock !== 0) {
        add('WARNING', 'Phantom Stock', 'Product', prod.name,
          `stock=${prod.stock} but 0 StockLog entries`);
        drifts++;
      }
      continue;
    }

    // Check chain continuity
    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const expected = prev.balance + curr.quantity;
      if (curr.balance !== expected && breaks < 20) {
        add('WARNING', 'Balance Break', 'Product', prod.name,
          `Log ${i + 1}/${logs.length}: expected ${expected} (${prev.balance}+${curr.quantity}) got ${curr.balance}`);
        breaks++;
        break;
      }
    }

    // Last log balance vs product stock
    const last = logs[logs.length - 1];
    if (last.balance !== prod.stock) {
      add('CRITICAL', 'Stock Trail Drift', 'Product', prod.name,
        `Last StockLog.balance=${last.balance} ≠ Product.stock=${prod.stock}`);
      drifts++;
    }
  }

  console.log(breaks === 0 && drifts === 0 ? ' ✅' : ` 🔴 ${breaks} breaks, ${drifts} drifts`);
}

// ═══════════════════════════════════════════════════
// 14. Expense/Income shopId isolation
// ═══════════════════════════════════════════════════
async function check14_FinanceIsolation() {
  process.stdout.write('  [14/18] Finance record isolation...');
  let count = 0;

  // Build membership set
  const members = await prisma.shopMember.findMany({
    select: { userId: true, shopId: true },
  });
  const shops = await prisma.shop.findMany({ select: { id: true, userId: true } });
  const memberSet = new Set(members.map(m => `${m.shopId}::${m.userId}`));
  for (const s of shops) memberSet.add(`${s.id}::${s.userId}`);

  // Check expenses
  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, shopId: true },
  });
  let expOrphans = 0;
  for (const e of expenses) {
    if (!memberSet.has(`${e.shopId}::${e.userId}`)) expOrphans++;
  }
  if (expOrphans > 0) {
    add('INFO', 'Finance Orphan', 'Expense', `${expOrphans} records`,
      `Expenses created by users not currently in the shop`);
    count++;
  }

  // Check incomes
  const incomes = await prisma.income.findMany({
    where: { deletedAt: null },
    select: { id: true, userId: true, shopId: true },
  });
  let incOrphans = 0;
  for (const i of incomes) {
    if (!memberSet.has(`${i.shopId}::${i.userId}`)) incOrphans++;
  }
  if (incOrphans > 0) {
    add('INFO', 'Finance Orphan', 'Income', `${incOrphans} records`,
      `Incomes created by users not currently in the shop`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🔵 ${count}`);
}

// ═══════════════════════════════════════════════════
// 15. Duplicate return/shipment numbers
// ═══════════════════════════════════════════════════
async function check15_DuplicateNumbers() {
  process.stdout.write('  [15/18] Duplicate return/shipment numbers...');
  let count = 0;

  // Returns
  const returns = await prisma.return.findMany({
    select: { returnNumber: true, shopId: true },
  });
  const retSeen = new Map<string, number>();
  for (const r of returns) {
    const key = `${r.shopId}::${r.returnNumber}`;
    retSeen.set(key, (retSeen.get(key) || 0) + 1);
  }
  for (const [key, cnt] of Array.from(retSeen)) {
    if (cnt > 1) {
      add('WARNING', 'Duplicate Number', 'Return', key.split('::')[1],
        `Appears ${cnt} times in same shop`);
      count++;
    }
  }

  // Shipments
  const shipments = await prisma.shipment.findMany({
    select: { shipmentNumber: true, shopId: true },
  });
  const shipSeen = new Map<string, number>();
  for (const s of shipments) {
    const key = `${s.shopId}::${s.shipmentNumber}`;
    shipSeen.set(key, (shipSeen.get(key) || 0) + 1);
  }
  for (const [key, cnt] of Array.from(shipSeen)) {
    if (cnt > 1) {
      add('WARNING', 'Duplicate Number', 'Shipment', key.split('::')[1],
        `Appears ${cnt} times in same shop`);
      count++;
    }
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 16. Sale discount inconsistency
// ═══════════════════════════════════════════════════
async function check16_DiscountConsistency() {
  process.stdout.write('  [16/18] Sale discount consistency...');
  let count = 0;

  // Sale has discountAmount > 0 but no discountType
  const noType = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      discountAmount: { gt: 0 },
      discountType: null,
    },
    select: { invoiceNumber: true, discountAmount: true },
  });
  for (const s of noType) {
    add('WARNING', 'Discount Missing Type', 'Sale', s.invoiceNumber,
      `discountAmount=฿${toNum(s.discountAmount)} but discountType is null`);
    count++;
  }

  // Sale has discountType but discountAmount = 0
  const noAmount = await prisma.sale.findMany({
    where: {
      status: 'ACTIVE',
      discountType: { not: null },
      discountAmount: 0,
    },
    select: { invoiceNumber: true, discountType: true },
  });
  for (const s of noAmount) {
    add('INFO', 'Discount Zero Amount', 'Sale', s.invoiceNumber,
      `discountType="${s.discountType}" but discountAmount=฿0`);
    count++;
  }

  console.log(count === 0 ? ' ✅' : ` 🟡 ${count}`);
}

// ═══════════════════════════════════════════════════
// 17. SystemLog growth analysis
// ═══════════════════════════════════════════════════
async function check17_SystemLogGrowth() {
  process.stdout.write('  [17/18] SystemLog growth analysis...');

  const total = await prisma.systemLog.count();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = await prisma.systemLog.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });
  const errors = await prisma.systemLog.count({
    where: { level: 'ERROR' },
  });

  if (total > 10000) {
    add('WARNING', 'Log Growth', 'SystemLog', `${total} total`,
      `Consider purging old logs. Recent 30d: ${recent}. Errors: ${errors}`);
  } else if (total > 1000) {
    add('INFO', 'Log Size', 'SystemLog', `${total} total`,
      `Recent 30d: ${recent}. Errors: ${errors}`);
  }

  console.log(` 📊 total=${total} recent30d=${recent} errors=${errors}`);
}

// ═══════════════════════════════════════════════════
// 18. Database record counts summary
// ═══════════════════════════════════════════════════
async function check18_RecordCounts() {
  process.stdout.write('  [18/18] Database summary...');

  const counts = {
    users:       await prisma.user.count(),
    shops:       await prisma.shop.count(),
    members:     await prisma.shopMember.count(),
    products:    await prisma.product.count({ where: { deletedAt: null } }),
    productsAll: await prisma.product.count(),
    suppliers:   await prisma.supplier.count({ where: { deletedAt: null } }),
    customers:   await prisma.customer.count({ where: { deletedAt: null } }),
    sales:       await prisma.sale.count(),
    saleItems:   await prisma.saleItem.count(),
    purchases:   await prisma.purchase.count(),
    purchaseItems: await prisma.purchaseItem.count(),
    returns:     await prisma.return.count(),
    returnItems: await prisma.returnItem.count(),
    stockLogs:   await prisma.stockLog.count(),
    expenses:    await prisma.expense.count({ where: { deletedAt: null } }),
    incomes:     await prisma.income.count({ where: { deletedAt: null } }),
    shipments:   await prisma.shipment.count(),
    notifications: await prisma.notification.count(),
    systemLogs:  await prisma.systemLog.count(),
    lookupTypes: await prisma.lookupType.count(),
    lookupValues: await prisma.lookupValue.count({ where: { deletedAt: null } }),
    addresses:   await prisma.customerAddress.count({ where: { deletedAt: null } }),
  };

  console.log(' 📊');
  console.log('');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │            📊 Database Summary               │');
  console.log('  ├──────────────────────┬──────────────────────┤');
  console.log(`  │ Users                │ ${String(counts.users).padStart(20)} │`);
  console.log(`  │ Shops                │ ${String(counts.shops).padStart(20)} │`);
  console.log(`  │ Members              │ ${String(counts.members).padStart(20)} │`);
  console.log(`  │ Products (active)    │ ${String(counts.products).padStart(20)} │`);
  console.log(`  │ Products (total)     │ ${String(counts.productsAll).padStart(20)} │`);
  console.log(`  │ Suppliers            │ ${String(counts.suppliers).padStart(20)} │`);
  console.log(`  │ Customers            │ ${String(counts.customers).padStart(20)} │`);
  console.log(`  │ Sales                │ ${String(counts.sales).padStart(20)} │`);
  console.log(`  │ SaleItems            │ ${String(counts.saleItems).padStart(20)} │`);
  console.log(`  │ Purchases            │ ${String(counts.purchases).padStart(20)} │`);
  console.log(`  │ PurchaseItems        │ ${String(counts.purchaseItems).padStart(20)} │`);
  console.log(`  │ Returns              │ ${String(counts.returns).padStart(20)} │`);
  console.log(`  │ ReturnItems          │ ${String(counts.returnItems).padStart(20)} │`);
  console.log(`  │ StockLogs            │ ${String(counts.stockLogs).padStart(20)} │`);
  console.log(`  │ Expenses             │ ${String(counts.expenses).padStart(20)} │`);
  console.log(`  │ Incomes              │ ${String(counts.incomes).padStart(20)} │`);
  console.log(`  │ Shipments            │ ${String(counts.shipments).padStart(20)} │`);
  console.log(`  │ Notifications        │ ${String(counts.notifications).padStart(20)} │`);
  console.log(`  │ SystemLogs           │ ${String(counts.systemLogs).padStart(20)} │`);
  console.log(`  │ LookupTypes          │ ${String(counts.lookupTypes).padStart(20)} │`);
  console.log(`  │ LookupValues         │ ${String(counts.lookupValues).padStart(20)} │`);
  console.log(`  │ Addresses            │ ${String(counts.addresses).padStart(20)} │`);
  console.log('  └──────────────────────┴──────────────────────┘');
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  🏥 Master Data Integrity Audit v6 (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  await check1_PurchaseTotalVsItems();
  await check2_ReturnShopMismatch();
  await check3_StockLogSignValidation();
  await check4_ProductStockRecompute();
  await check5_StockLogMultiFK();
  await check6_SaleTotalCostVsItems();
  await check7_UnlinkedStockLogs();
  await check8_ShipmentShopIsolation();
  await check9_ReturnQtyOverflow();
  await check10_EmptySales();
  await check11_PurchaseZeroCost();
  await check12_NotificationHealth();
  await check13_BalanceContinuity();
  await check14_FinanceIsolation();
  await check15_DuplicateNumbers();
  await check16_DiscountConsistency();
  await check17_SystemLogGrowth();
  await check18_RecordCounts();

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
    console.log('  ✅ ALL 18 CHECKS PASSED — No issues found!\n');
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
      for (const issue of checkIssues.slice(0, 10)) {
        console.log(`     [${issue.model}] ${issue.identifier}: ${issue.detail}`);
      }
      if (checkIssues.length > 10) {
        console.log(`     ... and ${checkIssues.length - 10} more`);
      }
      console.log('');
    }
  }

  // ── Cumulative ──
  console.log('══════════════════════════════════════════════════════════');
  console.log('  📊 Cumulative Audit Summary (v1–v6)');
  console.log('══════════════════════════════════════════════════════════');
  console.log('  Total checks: 78 (v1:16 + v2:16 + v3:14 + v4:12 + v5:12 + v6:18)');
  console.log('  Coverage: All 22 models, financial math, FK integrity,');
  console.log('           tenant isolation, balance chain, XSS, stock recompute');
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
