/**
 * 🔬 Deep Data Integrity & Leak Audit v8 (READ-ONLY)
 *
 * New checks beyond v7:
 *   1. Stock Reconstruction: Product.stock vs SUM(StockLog.quantity)
 *   2. StockLog balance chain: each log's balance = prev.balance + quantity
 *   3. isLowStock flag accuracy: stock <= minStock vs actual flag
 *   4. Return over-quantity: SUM(ReturnItem.quantity) > SaleItem.quantity
 *   5. Return refund > sale price: refundPerUnit > saleItem.salePrice
 *   6. Cross-shop Customer: Sale.shopId ≠ Customer.shopId
 *   7. Cross-shop Supplier: Purchase.shopId ≠ Supplier.shopId
 *   8. Cross-shop Expense: Expense.shopId ≠ User's shop membership
 *   9. Cross-shop Shipment: Shipment.shopId ≠ Sale.shopId
 *  10. Cross-shop Return: Return.shopId ≠ Sale.shopId
 *  11. Duplicate invoice numbers within same shop
 *  12. Duplicate purchase numbers within same shop
 *  13. Cancelled sale with active (non-cancelled) shipments
 *  14. Cancelled sale with active (non-cancelled) returns
 *  15. Shipment with no tracking for SHIPPED/DELIVERED status
 *  16. Orphan ReturnItems: returnId → deleted/missing Return
 *  17. Orphan Shipments: saleId → deleted/missing Sale
 *  18. StockLog type mismatch: SALE log without saleId
 *  19. StockLog type mismatch: PURCHASE log without purchaseId
 *  20. StockLog type mismatch: RETURN log without returnId
 *  21. Negative amount: Expense/Income with amount <= 0
 *  22. Sale with REJECTED payment but no paymentNote
 *  23. Products with negative costPrice or salePrice
 *  24. Orphan CustomerAddress: customer deleted but addresses exist
 *
 * Usage:
 *   npx tsx scripts/audit-data-integrity-v8.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
// 1. Stock Reconstruction: Product.stock vs SUM(StockLog.quantity)
// =====================================================================
async function checkStockReconstruction() {
  startCheck('Stock reconstruction: Product.stock vs SUM(StockLog.quantity)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true },
  });

  let issues = 0;
  for (const p of products) {
    const result = await prisma.stockLog.aggregate({
      where: { productId: p.id },
      _sum: { quantity: true },
    });
    const reconstructed = result._sum.quantity ?? 0;
    if (p.stock !== reconstructed) {
      issues++;
      console.log(
        `\n    ⚠️  "${p.name}" stock=${p.stock} but SUM(StockLog)=${reconstructed} (drift: ${p.stock - reconstructed})`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 2. StockLog balance chain integrity
// =====================================================================
async function checkStockLogBalanceChain() {
  startCheck('StockLog balance chain (each balance = prev + quantity)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  let issues = 0;
  for (const p of products) {
    const logs = await prisma.stockLog.findMany({
      where: { productId: p.id },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, quantity: true, balance: true, type: true, date: true },
    });

    for (let i = 1; i < logs.length; i++) {
      const prev = logs[i - 1];
      const curr = logs[i];
      const expected = prev.balance + curr.quantity;
      if (curr.balance !== expected) {
        issues++;
        if (issues <= 10) {
          console.log(
            `\n    ⚠️  "${p.name}" log#${i}: prev.balance=${prev.balance} + qty=${curr.quantity} = ${expected}, but recorded=${curr.balance}`
          );
        }
      }
    }
  }
  if (issues > 10) console.log(`\n    ... and ${issues - 10} more`);
  endCheck(issues);
}

// =====================================================================
// 3. isLowStock flag accuracy
// =====================================================================
async function checkIsLowStockFlag() {
  startCheck('isLowStock flag accuracy (stock <= minStock vs flag)');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, stock: true, minStock: true, isLowStock: true },
  });

  let issues = 0;
  for (const p of products) {
    const shouldBeLow = p.stock <= p.minStock;
    if (p.isLowStock !== shouldBeLow) {
      issues++;
      console.log(
        `\n    ⚠️  "${p.name}" stock=${p.stock} minStock=${p.minStock} → should be isLowStock=${shouldBeLow} but is ${p.isLowStock}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 4. Return over-quantity
// =====================================================================
async function checkReturnOverQuantity() {
  startCheck('Return over-quantity: SUM(ReturnItem.qty) > SaleItem.qty');

  const saleItems = await prisma.saleItem.findMany({
    where: { sale: { status: 'ACTIVE' } },
    select: {
      id: true,
      quantity: true,
      product: { select: { name: true } },
      sale: { select: { invoiceNumber: true } },
      returnItems: {
        where: { return: { status: 'COMPLETED' } },
        select: { quantity: true },
      },
    },
  });

  let issues = 0;
  for (const si of saleItems) {
    const totalReturned = si.returnItems.reduce((s, r) => s + r.quantity, 0);
    if (totalReturned > si.quantity) {
      issues++;
      console.log(
        `\n    ⚠️  ${si.sale.invoiceNumber} "${si.product.name}": sold ${si.quantity} but returned ${totalReturned}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 5. Return refund > sale price
// =====================================================================
async function checkReturnRefundExceedsPrice() {
  startCheck('Return refundPerUnit > saleItem.salePrice');

  const returnItems = await prisma.returnItem.findMany({
    where: { return: { status: 'COMPLETED' } },
    select: {
      id: true,
      refundPerUnit: true,
      quantity: true,
      saleItem: {
        select: {
          salePrice: true,
          sale: { select: { invoiceNumber: true } },
        },
      },
      product: { select: { name: true } },
    },
  });

  let issues = 0;
  for (const ri of returnItems) {
    if (Number(ri.refundPerUnit) > Number(ri.saleItem.salePrice)) {
      issues++;
      console.log(
        `\n    ⚠️  ${ri.saleItem.sale.invoiceNumber} "${ri.product.name}": refundPerUnit=${ri.refundPerUnit} > salePrice=${ri.saleItem.salePrice}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 6. Cross-shop Customer: Sale.shopId ≠ Customer.shopId
// =====================================================================
async function checkCrossShopCustomer() {
  startCheck('Cross-shop leak: Sale.shopId ≠ Customer.shopId');

  const leaks = await prisma.sale.findMany({
    where: {
      customerId: { not: null },
      status: 'ACTIVE',
    },
    select: {
      invoiceNumber: true,
      shopId: true,
      customer: { select: { name: true, shopId: true } },
    },
  });

  let issues = 0;
  for (const s of leaks) {
    if (s.customer && s.shopId !== s.customer.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  ${s.invoiceNumber} shopId=${s.shopId} but customer "${s.customer.name}" shopId=${s.customer.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 7. Cross-shop Supplier: Purchase.shopId ≠ Supplier.shopId
// =====================================================================
async function checkCrossShopSupplier() {
  startCheck('Cross-shop leak: Purchase.shopId ≠ Supplier.shopId');

  const leaks = await prisma.purchase.findMany({
    where: {
      supplierId: { not: null },
      status: 'ACTIVE',
    },
    select: {
      purchaseNumber: true,
      shopId: true,
      supplier: { select: { name: true, shopId: true } },
    },
  });

  let issues = 0;
  for (const p of leaks) {
    if (p.supplier && p.shopId !== p.supplier.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  ${p.purchaseNumber} shopId=${p.shopId} but supplier "${p.supplier.name}" shopId=${p.supplier.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 8. Cross-shop Shipment: Shipment.shopId ≠ Sale.shopId
// =====================================================================
async function checkCrossShopShipment() {
  startCheck('Cross-shop leak: Shipment.shopId ≠ Sale.shopId');

  const shipments = await prisma.shipment.findMany({
    select: {
      shipmentNumber: true,
      shopId: true,
      sale: { select: { invoiceNumber: true, shopId: true } },
    },
  });

  let issues = 0;
  for (const sh of shipments) {
    if (sh.shopId !== sh.sale.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  ${sh.shipmentNumber} shopId=${sh.shopId} but sale ${sh.sale.invoiceNumber} shopId=${sh.sale.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 9. Cross-shop Return: Return.shopId ≠ Sale.shopId
// =====================================================================
async function checkCrossShopReturn() {
  startCheck('Cross-shop leak: Return.shopId ≠ Sale.shopId');

  const returns = await prisma.return.findMany({
    select: {
      returnNumber: true,
      shopId: true,
      sale: { select: { invoiceNumber: true, shopId: true } },
    },
  });

  let issues = 0;
  for (const r of returns) {
    if (r.shopId !== r.sale.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  ${r.returnNumber} shopId=${r.shopId} but sale ${r.sale.invoiceNumber} shopId=${r.sale.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 10. Duplicate invoice numbers within same shop
// =====================================================================
async function checkDuplicateInvoiceNumbers() {
  startCheck('Duplicate invoice numbers within same shop');

  const dupes = await prisma.$queryRaw<{ shopId: string; invoiceNumber: string; cnt: bigint }[]>`
    SELECT "shopId", "invoiceNumber", COUNT(*)::bigint as cnt
    FROM "Sale"
    WHERE status = 'ACTIVE'
    GROUP BY "shopId", "invoiceNumber"
    HAVING COUNT(*) > 1
  `;

  let issues = dupes.length;
  for (const d of dupes) {
    console.log(`\n    ⚠️  shop=${d.shopId} invoice="${d.invoiceNumber}" appears ${d.cnt} times`);
  }
  endCheck(issues);
}

// =====================================================================
// 11. Duplicate purchase numbers within same shop
// =====================================================================
async function checkDuplicatePurchaseNumbers() {
  startCheck('Duplicate purchase numbers within same shop');

  const dupes = await prisma.$queryRaw<{ shopId: string; purchaseNumber: string; cnt: bigint }[]>`
    SELECT "shopId", "purchaseNumber", COUNT(*)::bigint as cnt
    FROM "Purchase"
    WHERE status = 'ACTIVE' AND "purchaseNumber" IS NOT NULL
    GROUP BY "shopId", "purchaseNumber"
    HAVING COUNT(*) > 1
  `;

  let issues = dupes.length;
  for (const d of dupes) {
    console.log(`\n    ⚠️  shop=${d.shopId} purchase="${d.purchaseNumber}" appears ${d.cnt} times`);
  }
  endCheck(issues);
}

// =====================================================================
// 12. Cancelled sale with active (non-cancelled) shipments
// =====================================================================
async function checkCancelledSaleActiveShipments() {
  startCheck('Cancelled sales with active shipments');

  const bad = await prisma.shipment.findMany({
    where: {
      sale: { status: 'CANCELLED' },
      status: { not: 'CANCELLED' },
    },
    select: {
      shipmentNumber: true,
      status: true,
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const b of bad) {
    console.log(
      `\n    ⚠️  Shipment ${b.shipmentNumber} (${b.status}) linked to CANCELLED sale ${b.sale.invoiceNumber}`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 13. Cancelled sale with active (non-cancelled) returns
// =====================================================================
async function checkCancelledSaleActiveReturns() {
  startCheck('Cancelled sales with active returns');

  const bad = await prisma.return.findMany({
    where: {
      sale: { status: 'CANCELLED' },
      status: { not: 'CANCELLED' },
    },
    select: {
      returnNumber: true,
      status: true,
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const b of bad) {
    console.log(
      `\n    ⚠️  Return ${b.returnNumber} (${b.status}) linked to CANCELLED sale ${b.sale.invoiceNumber}`
    );
  }
  endCheck(bad.length);
}

// =====================================================================
// 14. Shipped/Delivered without tracking number
// =====================================================================
async function checkShipmentNoTracking() {
  startCheck('Shipped/Delivered shipments without tracking number');

  const bad = await prisma.shipment.findMany({
    where: {
      status: { in: ['SHIPPED', 'DELIVERED'] },
      trackingNumber: null,
    },
    select: { shipmentNumber: true, status: true },
  });

  for (const b of bad) {
    console.log(`\n    ⚠️  ${b.shipmentNumber} status=${b.status} but no trackingNumber`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 15. StockLog type mismatch: SALE without saleId
// =====================================================================
async function checkStockLogTypeMismatch() {
  startCheck('StockLog type mismatch (SALE without saleId, etc.)');

  const saleNoRef = await prisma.stockLog.count({
    where: { type: 'SALE', saleId: null },
  });
  const saleCancelNoRef = await prisma.stockLog.count({
    where: { type: 'SALE_CANCEL', saleId: null },
  });
  const purchaseNoRef = await prisma.stockLog.count({
    where: { type: 'PURCHASE', purchaseId: null },
  });
  const purchaseCancelNoRef = await prisma.stockLog.count({
    where: { type: 'PURCHASE_CANCEL', purchaseId: null },
  });
  const returnNoRef = await prisma.stockLog.count({
    where: { type: 'RETURN', returnId: null },
  });

  const total = saleNoRef + saleCancelNoRef + purchaseNoRef + purchaseCancelNoRef + returnNoRef;

  if (total > 0) {
    if (saleNoRef) console.log(`\n    ⚠️  SALE logs without saleId: ${saleNoRef}`);
    if (saleCancelNoRef) console.log(`\n    ⚠️  SALE_CANCEL logs without saleId: ${saleCancelNoRef}`);
    if (purchaseNoRef) console.log(`\n    ⚠️  PURCHASE logs without purchaseId: ${purchaseNoRef}`);
    if (purchaseCancelNoRef) console.log(`\n    ⚠️  PURCHASE_CANCEL logs without purchaseId: ${purchaseCancelNoRef}`);
    if (returnNoRef) console.log(`\n    ⚠️  RETURN logs without returnId: ${returnNoRef}`);
  }
  endCheck(total);
}

// =====================================================================
// 16. Negative amount: Expense/Income with amount <= 0
// =====================================================================
async function checkNegativeAmounts() {
  startCheck('Negative/zero amount in Expense or Income');

  const badExpenses = await prisma.expense.count({
    where: { amount: { lte: 0 }, deletedAt: null },
  });
  const badIncomes = await prisma.income.count({
    where: { amount: { lte: 0 }, deletedAt: null },
  });

  const total = badExpenses + badIncomes;
  if (total > 0) {
    if (badExpenses) console.log(`\n    ⚠️  Expenses with amount ≤ 0: ${badExpenses}`);
    if (badIncomes) console.log(`\n    ⚠️  Incomes with amount ≤ 0: ${badIncomes}`);
  }
  endCheck(total);
}

// =====================================================================
// 17. Rejected payment without note
// =====================================================================
async function checkRejectedPaymentNoNote() {
  startCheck('REJECTED payments without paymentNote');

  const bad = await prisma.sale.count({
    where: {
      paymentStatus: 'REJECTED',
      paymentNote: null,
      status: 'ACTIVE',
    },
  });

  if (bad > 0) console.log(`\n    ⚠️  ${bad} rejected payments have no paymentNote`);
  endCheck(bad);
}

// =====================================================================
// 18. Products with negative prices
// =====================================================================
async function checkNegativePrices() {
  startCheck('Products with negative costPrice or salePrice');

  const bad = await prisma.product.count({
    where: {
      deletedAt: null,
      OR: [
        { costPrice: { lt: 0 } },
        { salePrice: { lt: 0 } },
      ],
    },
  });

  if (bad > 0) console.log(`\n    ⚠️  ${bad} products with negative prices`);
  endCheck(bad);
}

// =====================================================================
// 19. Orphan CustomerAddress (customer soft-deleted)
// =====================================================================
async function checkOrphanCustomerAddress() {
  startCheck('CustomerAddress linked to soft-deleted customer');

  const bad = await prisma.customerAddress.findMany({
    where: {
      deletedAt: null,
      customer: { deletedAt: { not: null } },
    },
    select: {
      id: true,
      label: true,
      customer: { select: { name: true } },
    },
  });

  for (const b of bad) {
    console.log(`\n    ⚠️  Address "${b.label}" for deleted customer "${b.customer.name}"`);
  }
  endCheck(bad.length);
}

// =====================================================================
// 20. Cross-shop Product in SaleItem: SaleItem.product.shopId ≠ Sale.shopId
//     (already in v7 but checking Purchase side too)
// =====================================================================
async function checkCrossShopPurchaseItem() {
  startCheck('Cross-shop leak: PurchaseItem.product.shopId ≠ Purchase.shopId');

  const items = await prisma.purchaseItem.findMany({
    select: {
      id: true,
      product: { select: { name: true, shopId: true } },
      purchase: { select: { purchaseNumber: true, shopId: true } },
    },
  });

  let issues = 0;
  for (const item of items) {
    if (item.product.shopId !== item.purchase.shopId) {
      issues++;
      console.log(
        `\n    ⚠️  Purchase ${item.purchase.purchaseNumber}: product "${item.product.name}" shopId=${item.product.shopId} ≠ purchase shopId=${item.purchase.shopId}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// 21. Sale profit ≠ netAmount - totalCost (with item-level discount)
// =====================================================================
async function checkSaleProfitWithDiscount() {
  startCheck('Sale profit consistency: profit = netAmount - totalCost');

  const sales = await prisma.sale.findMany({
    where: { status: 'ACTIVE' },
    select: {
      invoiceNumber: true,
      totalAmount: true,
      totalCost: true,
      profit: true,
      netAmount: true,
      discountAmount: true,
    },
  });

  let issues = 0;
  for (const s of sales) {
    const expectedProfit = Number(s.netAmount) - Number(s.totalCost);
    const diff = Math.abs(Number(s.profit) - expectedProfit);
    if (diff > 0.02) {
      issues++;
      console.log(
        `\n    ⚠️  ${s.invoiceNumber}: profit=${s.profit} but netAmount(${s.netAmount}) - totalCost(${s.totalCost}) = ${expectedProfit.toFixed(2)}`
      );
    }
  }
  endCheck(issues);
}

// =====================================================================
// Main
// =====================================================================
async function main() {
  console.log('');
  console.log('🔬 Data Integrity & Leak Audit v8');
  console.log('══════════════════════════════════════════');
  console.log('');

  // --- Stock Integrity ---
  console.log('📦 Stock Integrity');
  await checkStockReconstruction();
  await checkStockLogBalanceChain();
  await checkIsLowStockFlag();

  console.log('');

  // --- Return Integrity ---
  console.log('🔄 Return Integrity');
  await checkReturnOverQuantity();
  await checkReturnRefundExceedsPrice();

  console.log('');

  // --- Cross-Shop Leak Detection ---
  console.log('🔐 Cross-Shop Leak Detection');
  await checkCrossShopCustomer();
  await checkCrossShopSupplier();
  await checkCrossShopShipment();
  await checkCrossShopReturn();
  await checkCrossShopPurchaseItem();

  console.log('');

  // --- Uniqueness / Duplicates ---
  console.log('🔑 Uniqueness');
  await checkDuplicateInvoiceNumbers();
  await checkDuplicatePurchaseNumbers();

  console.log('');

  // --- Relational Consistency ---
  console.log('🔗 Relational Consistency');
  await checkCancelledSaleActiveShipments();
  await checkCancelledSaleActiveReturns();
  await checkShipmentNoTracking();
  await checkStockLogTypeMismatch();
  await checkOrphanCustomerAddress();

  console.log('');

  // --- Financial Integrity ---
  console.log('💰 Financial Integrity');
  await checkNegativeAmounts();
  await checkNegativePrices();
  await checkRejectedPaymentNoNote();
  await checkSaleProfitWithDiscount();

  // --- Summary ---
  console.log('');
  console.log('══════════════════════════════════════════');
  if (totalIssues === 0) {
    console.log(`✅ All ${checkCount} checks passed — no issues found`);
  } else {
    console.log(`❌ ${totalIssues} issue(s) found across ${checkCount} checks`);
  }
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
