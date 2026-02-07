'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { toNumber } from '@/lib/money';

// =============================================================================
// DATA EXPORT
// Server-side data fetching for CSV export (client calls downloadCSV)
// =============================================================================

/**
 * Export sales data for a date range
 */
export async function exportSalesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const sales = await db.sale.findMany({
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    select: {
      invoiceNumber: true,
      date: true,
      customerName: true,
      customer: { select: { name: true } },
      totalAmount: true,
      totalCost: true,
      profit: true,
      paymentMethod: true,
    },
    orderBy: { date: 'asc' },
  });

  return sales.map(s => ({
    Invoice: s.invoiceNumber,
    Date: s.date.toISOString().split('T')[0],
    Customer: s.customer?.name || s.customerName || 'Walk-in',
    Amount: toNumber(s.totalAmount),
    Cost: toNumber(s.totalCost),
    Profit: toNumber(s.profit),
    Payment: s.paymentMethod,
  }));
}

/**
 * Export products data
 */
export async function exportProductsData() {
  const ctx = await requirePermission('PRODUCT_VIEW');

  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
    },
    select: {
      name: true,
      sku: true,
      costPrice: true,
      salePrice: true,
      stock: true,
      minStock: true,
      isLowStock: true,
      category: true,
    },
    orderBy: { name: 'asc' },
  });

  return products.map(p => ({
    Name: p.name,
    SKU: p.sku || '',
    Category: p.category || '',
    CostPrice: toNumber(p.costPrice),
    SellingPrice: toNumber(p.salePrice),
    Stock: p.stock,
    MinStock: p.minStock,
    LowStock: p.isLowStock ? 'Yes' : 'No',
  }));
}

/**
 * Export expenses data for a date range
 */
export async function exportExpensesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const expenses = await db.expense.findMany({
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
      deletedAt: null,
    },
    select: {
      date: true,
      description: true,
      category: true,
      amount: true,
    },
    orderBy: { date: 'asc' },
  });

  return expenses.map(e => ({
    Date: e.date.toISOString().split('T')[0],
    Description: e.description,
    Category: e.category || '',
    Amount: toNumber(e.amount),
  }));
}
