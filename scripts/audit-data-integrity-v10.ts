/**
 * 🔬 Deep Data Integrity & Leak Audit v10 (READ-ONLY)
 *
 * Final-round checks not covered by v1–v9, designed from full schema review:
 *
 *   1.  Cross-shop Product in SaleItem — SaleItem.product.shopId ≠ Sale.shopId
 *   2.  Cross-shop Product in PurchaseItem — PurchaseItem.product.shopId ≠ Purchase.shopId
 *   3.  Purchase totalCost vs SUM(items subtotal) — math reconciliation
 *   4.  Sale item-level profit recalc — SaleItem.profit = (salePrice - discountAmount) × qty - costPrice × qty
 *   5.  Return refundAmount vs SUM(items refundAmount) — header vs items mismatch
 *   6.  ReturnItem.productId ≠ SaleItem.product — must match the original sale item's product
 *   7.  StockLog balance chain per product — each log's balance should = previous balance + quantity
 *   8.  Shipment on CANCELLED sale — shipment linked to cancelled sale but not cancelled itself
 *   9.  Expense/Income cross-shop — category LookupValue belongs to different shop
 *  10.  Customer with deleted-at but active sales — soft-deleted customer still referenced by active sales
 *  11.  Supplier with deleted-at but active purchases — same for partnerAddress
 *  12.  Duplicate customer name within shop — possible data duplication
 *  13.  ShopMember referencing non-existent Role — FK integrity
 *  14.  Sale netAmount vs totalAmount - discountAmount — net math check
 *  15.  PartnerAddress orphan — address where customer is soft-deleted
 *
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v10.ts
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
// 1. Cross-shop Product in SaleItem
//    SaleItem → Product.shopId must match Sale.shopId
// =====================================================================
async function checkCrossShopSaleItems() {
  startCheck('Cross-shop: SaleItem product belongs to different shop than Sale');

  const items = await prisma.saleItem.findMany({
    select: {
      id: true,
      sale: { select: { shopId: true, invoiceNumber: true } },
      product: { select: { shopId: true, name: true } },
    },
  });

  let issues = 0;
  for (const item of items) {
    if (item.sale.shopId !== item.product.shopId) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  Sale ${item.sale.invoiceNumber}: product "${item.product.name}" belongs to shopId=${item.product.shopId}, sale shopId=${item.sale.shopId}`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 2. Cross-shop Product in PurchaseItem
//    PurchaseItem → Product.shopId must match Purchase.shopId
// =====================================================================
async function checkCrossShopPurchaseItems() {
  startCheck('Cross-shop: PurchaseItem product belongs to different shop than Purchase');

  const items = await prisma.purchaseItem.findMany({
    select: {
      id: true,
      purchase: { select: { shopId: true, purchaseNumber: true } },
      product: { select: { shopId: true, name: true } },
    },
  });

  let issues = 0;
  for (const item of items) {
    if (item.purchase.shopId !== item.product.shopId) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  Purchase ${item.purchase.purchaseNumber}: product "${item.product.name}" belongs to different shop`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 3. Purchase totalCost vs SUM(items subtotal)
//    createPurchase: totalCost = items.reduce(sum, calcSubtotal(qty, costPrice))
// =====================================================================
async function checkPurchaseTotalVsItems() {
  startCheck('Purchase totalCost vs SUM(items.subtotal)');

  const purchases = await prisma.purchase.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      purchaseNumber: true,
      totalCost: true,
      items: { select: { subtotal: true } },
    },
  });

  let issues = 0;
  for (const p of purchases) {
    const sumItems = p.items.reduce((sum, i) => sum + toNum(i.subtotal), 0);
    const headerTotal = toNum(p.totalCost);
    const diff = Math.abs(headerTotal - sumItems);

    if (diff > 0.02) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  ${p.purchaseNumber}: totalCost=฿${headerTotal.toFixed(2)} but SUM(items)=฿${sumItems.toFixed(2)} (diff=฿${diff.toFixed(2)})`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 4. SaleItem profit recalc
//    profit = (salePrice - discountAmount) × qty - costPrice × qty
// =====================================================================
async function checkSaleItemProfit() {
  startCheck('SaleItem profit recalculation');

  const items = await prisma.saleItem.findMany({
    where: { sale: { status: 'ACTIVE' } },
    select: {
      id: true,
      quantity: true,
      salePrice: true,
      costPrice: true,
      subtotal: true,
      profit: true,
      discountAmount: true,
      sale: { select: { invoiceNumber: true } },
      product: { select: { name: true } },
    },
  });

  let issues = 0;
  for (const item of items) {
    const sp = toNum(item.salePrice);
    const cp = toNum(item.costPrice);
    const disc = toNum(item.discountAmount);
    const qty = item.quantity;

    const expectedSubtotal = (sp - disc) * qty;
    const expectedProfit = expectedSubtotal - cp * qty;
    const actualProfit = toNum(item.profit);
    const actualSubtotal = toNum(item.subtotal);

    const subtotalDiff = Math.abs(actualSubtotal - expectedSubtotal);
    const profitDiff = Math.abs(actualProfit - expectedProfit);

    if (subtotalDiff > 0.02 || profitDiff > 0.02) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  ${item.sale.invoiceNumber} / "${item.product.name}": subtotal=${actualSubtotal.toFixed(2)} (expected=${expectedSubtotal.toFixed(2)}), profit=${actualProfit.toFixed(2)} (expected=${expectedProfit.toFixed(2)})`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 5. Return refundAmount vs SUM(items refundAmount)
// =====================================================================
async function checkReturnRefundVsItems() {
  startCheck('Return refundAmount vs SUM(items.refundAmount)');

  const returns = await prisma.return.findMany({
    where: { status: 'COMPLETED' },
    select: {
      returnNumber: true,
      refundAmount: true,
      items: { select: { refundAmount: true } },
    },
  });

  let issues = 0;
  for (const r of returns) {
    const sumItems = r.items.reduce((sum, i) => sum + toNum(i.refundAmount), 0);
    const headerRefund = toNum(r.refundAmount);
    const diff = Math.abs(headerRefund - sumItems);

    if (diff > 0.02) {
      issues++;
      console.log(
        `\n    ⚠️  ${r.returnNumber}: refundAmount=฿${headerRefund.toFixed(2)} but SUM(items)=฿${sumItems.toFixed(2)}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 6. ReturnItem.productId must match SaleItem.productId
//    (the return item should be returning the SAME product from the sale)
// =====================================================================
async function checkReturnItemProductMismatch() {
  startCheck('ReturnItem.productId vs SaleItem.productId mismatch');

  const returnItems = await prisma.returnItem.findMany({
    select: {
      id: true,
      productId: true,
      saleItem: { select: { productId: true } },
      return: { select: { returnNumber: true } },
    },
  });

  let issues = 0;
  for (const ri of returnItems) {
    if (ri.productId !== ri.saleItem.productId) {
      issues++;
      console.log(
        `\n    ⚠️  ${ri.return.returnNumber}: ReturnItem.productId=${ri.productId} ≠ SaleItem.productId=${ri.saleItem.productId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 7. StockLog balance chain per product
//    For each product, ordered by date: each log's balance should =
//    previous log's balance + current log's quantity
// =====================================================================
async function checkStockLogBalanceChain() {
  startCheck('StockLog balance chain continuity (per product)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let issues = 0;
  let checked = 0;

  for (const product of products) {
    const logs = await prisma.stockLog.findMany({
      where: { productId: product.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, quantity: true, balance: true, type: true, date: true },
    });

    if (logs.length < 2) continue;
    checked++;

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const expectedBalance = prev.balance + curr.quantity;

      if (expectedBalance !== curr.balance) {
        issues++;
        if (issues <= 10) {
          console.log(
            `\n    ⚠️  "${product.name}": log[${i}] balance=${curr.balance} but expected=${expectedBalance} (prev.balance=${prev.balance} + qty=${curr.quantity}) type=${curr.type}`
          );
        }
      }
    }
  }
  if (issues > 10) console.log(`\n    ... and ${issues - 10} more`);
  if (issues === 0) console.log(`(${checked} products with 2+ logs)`);
  endCheck(issues);
}

// =====================================================================
// 8. Shipment on CANCELLED sale (not cancelled itself)
// =====================================================================
async function checkShipmentOnCancelledSale() {
  startCheck('Active shipments linked to CANCELLED sales');

  const bad = await prisma.shipment.findMany({
    where: {
      status: { not: 'CANCELLED' },
      sale: { status: 'CANCELLED' },
    },
    select: {
      shipmentNumber: true,
      status: true,
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const s of bad) {
    console.log(
      `\n    ⚠️  ${s.shipmentNumber} (${s.status}): linked to CANCELLED sale ${s.sale.invoiceNumber}`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 9. Expense/Income categoryId cross-shop
//    LookupValue.shopId should match Expense/Income.shopId
// =====================================================================
async function checkExpenseIncomeCrossShopCategory() {
  startCheck('Expense/Income categoryId from different shop');

  let issues = 0;

  // Expenses
  const expenses = await prisma.expense.findMany({
    where: { deletedAt: null, categoryId: { not: null } },
    select: {
      id: true,
      shopId: true,
      category: true,
      categoryRef: { select: { shopId: true, name: true } },
    },
  });

  for (const e of expenses) {
    if (e.categoryRef && e.categoryRef.shopId && e.categoryRef.shopId !== e.shopId) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  Expense: category "${e.categoryRef.name}" shopId=${e.categoryRef.shopId} ≠ expense shopId=${e.shopId}`
        );
      }
    }
  }

  // Incomes
  const incomes = await prisma.income.findMany({
    where: { deletedAt: null, categoryId: { not: null } },
    select: {
      id: true,
      shopId: true,
      category: true,
      categoryRef: { select: { shopId: true, name: true } },
    },
  });

  for (const inc of incomes) {
    if (inc.categoryRef && inc.categoryRef.shopId && inc.categoryRef.shopId !== inc.shopId) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  Income: category "${inc.categoryRef.name}" belongs to different shop`
        );
      }
    }
  }

  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 10. Soft-deleted customer still referenced by active sales
// =====================================================================
async function checkDeletedCustomerActiveSales() {
  startCheck('Soft-deleted customers with active sales');

  const bad = await prisma.customer.findMany({
    where: {
      deletedAt: { not: null },
      sales: { some: { status: 'ACTIVE' } },
    },
    select: {
      name: true,
      _count: { select: { sales: { where: { status: 'ACTIVE' } } } },
    },
  });

  for (const c of bad) {
    console.log(`\n    ⚠️  Customer "${c.name}": deleted but has ${c._count.sales} active sale(s)`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 11. Soft-deleted supplier with active purchases
// =====================================================================
async function checkDeletedSupplierActivePurchases() {
  startCheck('Soft-deleted suppliers with active purchases');

  const bad = await prisma.supplier.findMany({
    where: {
      deletedAt: { not: null },
      purchases: { some: { status: 'ACTIVE' } },
    },
    select: {
      name: true,
      _count: { select: { purchases: { where: { status: 'ACTIVE' } } } },
    },
  });

  for (const s of bad) {
    console.log(`\n    ⚠️  Supplier "${s.name}": deleted but has ${s._count.purchases} active purchase(s)`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 12. Duplicate customer name within same shop
// =====================================================================
async function checkDuplicateCustomerNames() {
  startCheck('Duplicate customer names within same shop');

  const dupes: Array<{ shopId: string; name: string; cnt: bigint }> = await prisma.$queryRaw`
    SELECT "shopId", "name", COUNT(*) as cnt
    FROM "Customer"
    WHERE "deletedAt" IS NULL
    GROUP BY "shopId", "name"
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
  `;

  let issues = 0;
  for (const d of dupes) {
    issues++;
    console.log(`\n    ⚠️  Shop ${d.shopId.substring(0, 8)}...: customer "${d.name}" appears ${d.cnt} times`);
  }
  endCheck(issues);
}

// =====================================================================
// 13. ShopMember referencing non-existent Role
// =====================================================================
async function checkShopMemberOrphanRole() {
  startCheck('ShopMember with non-existent or wrong-shop Role');

  const members = await prisma.shopMember.findMany({
    select: {
      id: true,
      shopId: true,
      user: { select: { email: true } },
      role: { select: { id: true, shopId: true, name: true } },
    },
  });

  let issues = 0;
  for (const m of members) {
    if (m.shopId !== m.role.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  Member ${m.user.email}: role "${m.role.name}" belongs to shopId=${m.role.shopId}, member shopId=${m.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 14. Sale netAmount vs totalAmount - discountAmount
//     netAmount = totalAmount - discountAmount (before returns adjust it)
//     We check: netAmount + SUM(return refunds) should ≈ totalAmount - discountAmount
// =====================================================================
async function checkSaleNetAmountMath() {
  startCheck('Sale netAmount + returns ≈ totalAmount - discountAmount');

  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      discountAmount: true,
      netAmount: true,
      returns: {
        where: { status: 'COMPLETED' },
        select: { refundAmount: true },
      },
    },
  });

  let issues = 0;
  for (const s of sales) {
    const total = toNum(s.totalAmount);
    const discount = toNum(s.discountAmount);
    const net = toNum(s.netAmount);
    const totalReturns = s.returns.reduce((sum, r) => sum + toNum(r.refundAmount), 0);

    // Expected: netAmount = totalAmount - discountAmount - totalReturns
    const expected = total - discount - totalReturns;
    const diff = Math.abs(net - expected);

    if (diff > 0.05) {
      issues++;
      if (issues <= 5) {
        console.log(
          `\n    ⚠️  ${s.invoiceNumber}: netAmount=฿${net.toFixed(2)} but expected=฿${expected.toFixed(2)} (total=${total.toFixed(2)} - disc=${discount.toFixed(2)} - returns=${totalReturns.toFixed(2)})`
        );
      }
    }
  }
  if (issues > 5) console.log(`\n    ... and ${issues - 5} more`);
  endCheck(issues);
}

// =====================================================================
// 15. PartnerAddress orphan: address with soft-deleted customer
// =====================================================================
async function checkCustomerAddressOrphans() {
  startCheck('PartnerAddress where customer is soft-deleted');

  const bad = await (prisma as any).partnerAddress.findMany({
    where: {
      deletedAt: null,
      customer: { deletedAt: { not: null } },
    },
    select: {
      id: true,
      label: true,
      recipientName: true,
      customer: { select: { name: true } },
    },
  });

  for (const a of bad.slice(0, 5)) {
    console.log(
      `\n    ⚠️  Address "${a.label || a.recipientName}": customer "${a.customer.name}" is soft-deleted`
    );
  }
  if (bad.length > 5) console.log(`\n    ... and ${bad.length - 5} more`);
  endCheck(bad.length);
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log('');
  console.log('🔬 Data Integrity & Leak Audit v10');
  console.log('══════════════════════════════════════════');
  console.log('');

  // --- Cross-shop Isolation ---
  console.log('🔒 Cross-shop Tenant Isolation');
  await checkCrossShopSaleItems();
  await checkCrossShopPurchaseItems();
  await checkExpenseIncomeCrossShopCategory();
  await checkShopMemberOrphanRole();

  console.log('');

  // --- Financial Math ---
  console.log('💰 Financial Math Reconciliation');
  await checkPurchaseTotalVsItems();
  await checkSaleItemProfit();
  await checkSaleNetAmountMath();
  await checkReturnRefundVsItems();
  await checkReturnItemProductMismatch();

  console.log('');

  // --- Stock Chain ---
  console.log('📦 Stock Log Balance Chain');
  await checkStockLogBalanceChain();

  console.log('');

  // --- Referential Integrity ---
  console.log('🔗 Referential & Lifecycle Integrity');
  await checkShipmentOnCancelledSale();
  await checkDeletedCustomerActiveSales();
  await checkDeletedSupplierActivePurchases();
  await checkDuplicateCustomerNames();
  await checkCustomerAddressOrphans();

  // --- Summary ---
  console.log('');
  console.log('══════════════════════════════════════════');
  if (totalIssues === 0) {
    console.log(`✅ All ${checkCount} checks passed — no issues found`);
  } else {
    console.log(`❌ ${totalIssues} issue(s) found across ${checkCount} checks`);
  }

  console.log('');
  console.log('📊 Cumulative: v1-v9(143) + v10(15) = 158 checks');
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
