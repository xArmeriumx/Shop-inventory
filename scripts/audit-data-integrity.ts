/**
 * Data Integrity Audit Script
 * 
 * Checks ALL models for data inconsistencies:
 *   1. Sale: netAmount / profit / discountAmount consistency
 *   2. SaleItem: subtotal ≠ qty × price, profit mismatch
 *   3. Purchase: totalCost vs sum of items
 *   4. Product: stock vs StockLog computed balance
 *   5. Product: isLowStock flag out of sync
 *   6. Sale ↔ SaleItem: header totalAmount vs sum of items
 * 
 * ⚠️ READ-ONLY — this script only reports, never writes.
 * 
 * Usage:
 *   npx tsx scripts/audit-data-integrity.ts
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
  model: string;
  id: string;
  identifier: string;
  field: string;
  expected: string;
  actual: string;
  description: string;
}

const issues: Issue[] = [];

function addIssue(issue: Issue) {
  issues.push(issue);
}

// ═══════════════════════════════════════════════════
// CHECK 1: Sale financial consistency
// ═══════════════════════════════════════════════════
async function checkSaleFinancials() {
  console.log('🔍 [1/6] Checking Sale financials...');
  
  const sales = await prisma.sale.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      invoiceNumber: true,
      shopId: true,
      totalAmount: true,
      totalCost: true,
      profit: true,
      discountAmount: true,
      discountType: true,
      discountValue: true,
      netAmount: true,
    },
  });

  for (const sale of sales) {
    const totalAmount = toNumber(sale.totalAmount);
    const discountAmount = toNumber(sale.discountAmount);
    const netAmount = toNumber(sale.netAmount);
    const totalCost = toNumber(sale.totalCost);
    const profit = toNumber(sale.profit);

    // Check: netAmount = totalAmount - discountAmount
    const expectedNet = round2(totalAmount - discountAmount);
    if (Math.abs(expectedNet - netAmount) > 0.01) {
      addIssue({
        severity: 'CRITICAL',
        model: 'Sale',
        id: sale.id,
        identifier: sale.invoiceNumber,
        field: 'netAmount',
        expected: `${expectedNet}`,
        actual: `${netAmount}`,
        description: `netAmount ≠ totalAmount(${totalAmount}) - discount(${discountAmount})`,
      });
    }

    // Check: profit = netAmount - totalCost
    const expectedProfit = round2(netAmount - totalCost);
    if (Math.abs(expectedProfit - profit) > 0.01) {
      addIssue({
        severity: 'WARNING',
        model: 'Sale',
        id: sale.id,
        identifier: sale.invoiceNumber,
        field: 'profit',
        expected: `${expectedProfit}`,
        actual: `${profit}`,
        description: `profit ≠ netAmount(${netAmount}) - totalCost(${totalCost})`,
      });
    }

    // Check: discountAmount > 0 but discountType is null
    if (discountAmount > 0 && !sale.discountType) {
      addIssue({
        severity: 'WARNING',
        model: 'Sale',
        id: sale.id,
        identifier: sale.invoiceNumber,
        field: 'discountType',
        expected: 'PERCENT or FIXED',
        actual: 'null',
        description: `Has discountAmount(${discountAmount}) but no discountType`,
      });
    }
  }

  console.log(`   ✓ Checked ${sales.length} sales`);
}

// ═══════════════════════════════════════════════════
// CHECK 2: Sale header vs SaleItems totals
// ═══════════════════════════════════════════════════
async function checkSaleVsItems() {
  console.log('🔍 [2/6] Checking Sale totals vs SaleItem sums...');

  const sales = await prisma.sale.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      totalCost: true,
      items: {
        select: {
          subtotal: true,
          costPrice: true,
          quantity: true,
          profit: true,
          discountAmount: true,
        },
      },
    },
  });

  for (const sale of sales) {
    const headerTotal = toNumber(sale.totalAmount);
    const headerCost = toNumber(sale.totalCost);
    
    let itemsTotal = 0;
    let itemsCost = 0;

    for (const item of sale.items) {
      itemsTotal = round2(itemsTotal + toNumber(item.subtotal));
      itemsCost = round2(itemsCost + round2(toNumber(item.costPrice) * item.quantity));
    }

    // Check: Sale.totalAmount ≈ SUM(SaleItem.subtotal)
    if (Math.abs(headerTotal - itemsTotal) > 0.01) {
      addIssue({
        severity: 'CRITICAL',
        model: 'Sale',
        id: sale.id,
        identifier: sale.invoiceNumber,
        field: 'totalAmount vs items',
        expected: `${itemsTotal} (from ${sale.items.length} items)`,
        actual: `${headerTotal}`,
        description: `Header totalAmount doesn't match SUM of item subtotals`,
      });
    }

    // Check: Sale.totalCost ≈ SUM(SaleItem.costPrice × qty)
    if (Math.abs(headerCost - itemsCost) > 0.01) {
      addIssue({
        severity: 'WARNING',
        model: 'Sale',
        id: sale.id,
        identifier: sale.invoiceNumber,
        field: 'totalCost vs items',
        expected: `${itemsCost}`,
        actual: `${headerCost}`,
        description: `Header totalCost doesn't match SUM of item costs`,
      });
    }
  }

  console.log(`   ✓ Checked ${sales.length} sales with items`);
}

// ═══════════════════════════════════════════════════
// CHECK 3: SaleItem subtotal & profit
// ═══════════════════════════════════════════════════
async function checkSaleItemConsistency() {
  console.log('🔍 [3/6] Checking SaleItem subtotal & profit...');

  const items = await prisma.saleItem.findMany({
    select: {
      id: true,
      saleId: true,
      quantity: true,
      salePrice: true,
      costPrice: true,
      subtotal: true,
      profit: true,
      discountAmount: true,
      sale: { select: { invoiceNumber: true } },
    },
  });

  for (const item of items) {
    const qty = item.quantity;
    const price = toNumber(item.salePrice);
    const cost = toNumber(item.costPrice);
    const subtotal = toNumber(item.subtotal);
    const profit = toNumber(item.profit);
    const discount = toNumber(item.discountAmount);

    // subtotal should = (salePrice × qty) - discountAmount
    const expectedSubtotal = round2(price * qty - discount);
    if (Math.abs(expectedSubtotal - subtotal) > 0.01) {
      addIssue({
        severity: 'WARNING',
        model: 'SaleItem',
        id: item.id,
        identifier: `${item.sale.invoiceNumber} item`,
        field: 'subtotal',
        expected: `${expectedSubtotal} (${price}×${qty}-${discount})`,
        actual: `${subtotal}`,
        description: `subtotal ≠ salePrice × qty - discount`,
      });
    }

    // profit should = subtotal - (cost × qty)
    const expectedProfit = round2(subtotal - cost * qty);
    if (Math.abs(expectedProfit - profit) > 0.01) {
      addIssue({
        severity: 'WARNING',
        model: 'SaleItem',
        id: item.id,
        identifier: `${item.sale.invoiceNumber} item`,
        field: 'profit',
        expected: `${expectedProfit}`,
        actual: `${profit}`,
        description: `profit ≠ subtotal(${subtotal}) - cost(${cost}×${qty})`,
      });
    }
  }

  console.log(`   ✓ Checked ${items.length} sale items`);
}

// ═══════════════════════════════════════════════════
// CHECK 4: Purchase totalCost vs PurchaseItems
// ═══════════════════════════════════════════════════
async function checkPurchaseVsItems() {
  console.log('🔍 [4/6] Checking Purchase totals vs PurchaseItem sums...');

  const purchases = await prisma.purchase.findMany({
    where: { status: { not: 'CANCELLED' } },
    select: {
      id: true,
      purchaseNumber: true,
      totalCost: true,
      items: {
        select: { subtotal: true, costPrice: true, quantity: true },
      },
    },
  });

  for (const pur of purchases) {
    const headerCost = toNumber(pur.totalCost);
    const itemsSum = pur.items.reduce((sum, i) => round2(sum + toNumber(i.subtotal)), 0);

    if (Math.abs(headerCost - itemsSum) > 0.01) {
      addIssue({
        severity: 'CRITICAL',
        model: 'Purchase',
        id: pur.id,
        identifier: pur.purchaseNumber || pur.id,
        field: 'totalCost vs items',
        expected: `${itemsSum} (from ${pur.items.length} items)`,
        actual: `${headerCost}`,
        description: `Header totalCost doesn't match SUM of item subtotals`,
      });
    }
  }

  console.log(`   ✓ Checked ${purchases.length} purchases`);
}

// ═══════════════════════════════════════════════════
// CHECK 5: Product stock vs StockLog balance
// ═══════════════════════════════════════════════════
async function checkProductStock() {
  console.log('🔍 [5/6] Checking Product stock vs StockLog balance...');

  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      stock: true,
      minStock: true,
      isLowStock: true,
      stockLogs: {
        select: { quantity: true },
      },
    },
  });

  for (const prod of products) {
    // Sum all stock changes from logs
    const logBalance = prod.stockLogs.reduce((sum, log) => sum + log.quantity, 0);

    // stock should equal sum of all stock log changes
    if (prod.stock !== logBalance) {
      addIssue({
        severity: 'CRITICAL',
        model: 'Product',
        id: prod.id,
        identifier: prod.name,
        field: 'stock',
        expected: `${logBalance} (from ${prod.stockLogs.length} logs)`,
        actual: `${prod.stock}`,
        description: `Product.stock doesn't match SUM of StockLog changes`,
      });
    }
  }

  console.log(`   ✓ Checked ${products.length} products`);
}

// ═══════════════════════════════════════════════════
// CHECK 6: Product isLowStock flag sync
// ═══════════════════════════════════════════════════
async function checkLowStockFlag() {
  console.log('🔍 [6/6] Checking Product isLowStock flag...');

  const products = await prisma.product.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      stock: true,
      minStock: true,
      isLowStock: true,
    },
  });

  for (const prod of products) {
    const shouldBeLow = prod.stock <= prod.minStock;
    if (shouldBeLow !== prod.isLowStock) {
      addIssue({
        severity: 'WARNING',
        model: 'Product',
        id: prod.id,
        identifier: prod.name,
        field: 'isLowStock',
        expected: `${shouldBeLow} (stock=${prod.stock}, minStock=${prod.minStock})`,
        actual: `${prod.isLowStock}`,
        description: `isLowStock flag out of sync with actual stock level`,
      });
    }
  }

  console.log(`   ✓ Checked ${products.length} products`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  🏥 Data Integrity Audit (READ-ONLY)');
  console.log('══════════════════════════════════════════════════════\n');

  await checkSaleFinancials();
  await checkSaleVsItems();
  await checkSaleItemConsistency();
  await checkPurchaseVsItems();
  await checkProductStock();
  await checkLowStockFlag();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  📋 Results');
  console.log('══════════════════════════════════════════════════════\n');

  const critical = issues.filter(i => i.severity === 'CRITICAL');
  const warnings = issues.filter(i => i.severity === 'WARNING');
  const info = issues.filter(i => i.severity === 'INFO');

  if (issues.length === 0) {
    console.log('  ✅ ALL CHECKS PASSED — No data integrity issues found!\n');
  } else {
    console.log(`  Found ${issues.length} issue(s):`);
    console.log(`    🔴 CRITICAL: ${critical.length}`);
    console.log(`    🟡 WARNING:  ${warnings.length}`);
    console.log(`    🔵 INFO:     ${info.length}`);
    console.log('');

    // Print critical first
    for (const issue of [...critical, ...warnings, ...info]) {
      const icon = issue.severity === 'CRITICAL' ? '🔴' : issue.severity === 'WARNING' ? '🟡' : '🔵';
      console.log(`  ${icon} [${issue.model}] ${issue.identifier}`);
      console.log(`     Field: ${issue.field}`);
      console.log(`     Expected: ${issue.expected}`);
      console.log(`     Actual:   ${issue.actual}`);
      console.log(`     ${issue.description}`);
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
