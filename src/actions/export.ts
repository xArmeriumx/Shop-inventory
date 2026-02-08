'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { toNumber } from '@/lib/money';

// =============================================================================
// DATA EXPORT
// Server-side data fetching for CSV export (client calls downloadCSV)
// =============================================================================



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
 * Export purchases data for a date range
 */
export async function exportPurchasesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const purchases = await db.purchase.findMany({
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
    },
    select: {
      purchaseNumber: true,
      date: true,
      totalCost: true,
      status: true,
      notes: true,
      supplier: { select: { name: true } },
      items: {
        select: {
          product: { select: { name: true } },
          quantity: true,
          costPrice: true,
          subtotal: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Flatten: one row per purchase item for detailed export
  const rows: any[] = [];
  for (const p of purchases) {
    if (p.items.length === 0) {
      rows.push({
        PurchaseNumber: p.purchaseNumber || '',
        Date: p.date.toISOString().split('T')[0],
        Supplier: p.supplier?.name || '',
        Product: '',
        Quantity: 0,
        CostPrice: 0,
        Subtotal: 0,
        TotalCost: toNumber(p.totalCost),
        Status: p.status || 'ACTIVE',
        Notes: p.notes || '',
      });
    } else {
      for (const item of p.items) {
        rows.push({
          PurchaseNumber: p.purchaseNumber || '',
          Date: p.date.toISOString().split('T')[0],
          Supplier: p.supplier?.name || '',
          Product: item.product.name,
          Quantity: item.quantity,
          CostPrice: toNumber(item.costPrice),
          Subtotal: toNumber(item.subtotal),
          TotalCost: toNumber(p.totalCost),
          Status: p.status || 'ACTIVE',
          Notes: p.notes || '',
        });
      }
    }
  }

  return rows;
}

/**
 * Export returns data for a date range
 */
export async function exportReturnsData(startDate: string, endDate: string) {
  const ctx = await requirePermission('RETURN_VIEW');

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const returns = await db.return.findMany({
    where: {
      shopId: ctx.shopId,
      createdAt: { gte: start, lte: end },
    },
    select: {
      returnNumber: true,
      createdAt: true,
      reason: true,
      refundMethod: true,
      refundAmount: true,
      sale: { select: { invoiceNumber: true } },
      items: {
        select: {
          product: { select: { name: true } },
          quantity: true,
          refundPerUnit: true,
          refundAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Flatten: one row per return item
  const rows: any[] = [];
  for (const r of returns) {
    if (r.items.length === 0) {
      rows.push({
        ReturnNumber: r.returnNumber,
        Date: r.createdAt.toISOString().split('T')[0],
        SaleInvoice: r.sale?.invoiceNumber || '',
        Reason: r.reason,
        Product: '',
        Quantity: 0,
        RefundPerUnit: 0,
        ItemRefund: 0,
        TotalRefund: toNumber(r.refundAmount),
        RefundMethod: r.refundMethod,
      });
    } else {
      for (const item of r.items) {
        rows.push({
          ReturnNumber: r.returnNumber,
          Date: r.createdAt.toISOString().split('T')[0],
          SaleInvoice: r.sale?.invoiceNumber || '',
          Reason: r.reason,
          Product: item.product.name,
          Quantity: item.quantity,
          RefundPerUnit: toNumber(item.refundPerUnit),
          ItemRefund: toNumber(item.refundAmount),
          TotalRefund: toNumber(r.refundAmount),
          RefundMethod: r.refundMethod,
        });
      }
    }
  }

  return rows;
}

/**
 * Export customers data (all active customers with aggregated stats)
 */
export async function exportCustomersData() {
  const ctx = await requirePermission('CUSTOMER_VIEW');

  const customers = await db.customer.findMany({
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
    },
    select: {
      name: true,
      phone: true,
      email: true,
      address: true,
      taxId: true,
      notes: true,
      createdAt: true,
      _count: {
        select: { sales: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return customers.map(c => ({
    Name: c.name,
    Phone: c.phone || '',
    Email: c.email || '',
    Address: c.address || '',
    TaxID: c.taxId || '',
    Notes: c.notes || '',
    TotalOrders: c._count.sales,
    RegisteredDate: c.createdAt.toISOString().split('T')[0],
  }));
}

/**
 * Export incomes data for a date range
 */
export async function exportIncomesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('INCOME_VIEW');

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const incomes = await db.income.findMany({
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      description: true,
      category: true,
      amount: true,
    },
    orderBy: { date: 'asc' },
  });

  return incomes.map(i => ({
    Date: i.date.toISOString().split('T')[0],
    Description: i.description,
    Category: i.category || '',
    Amount: toNumber(i.amount),
  }));
}

/**
 * Export sales data for a date range (item-level detail)
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
      status: { not: 'CANCELLED' },  // ✅ ไม่รวมบิลที่ยกเลิก
    },
    select: {
      invoiceNumber: true,
      date: true,
      customerName: true,
      customer: { select: { name: true } },
      paymentMethod: true,
      channel: true,
      status: true,
      totalAmount: true,
      totalCost: true,
      profit: true,
      discountAmount: true,
      notes: true,
      items: {
        select: {
          product: { select: { name: true, sku: true } },
          quantity: true,
          salePrice: true,
          subtotal: true,
          costPrice: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const rows: any[] = [];

  for (const s of sales) {
    const customerName = s.customer?.name || s.customerName || 'ลูกค้าทั่วไป';

    if (s.items.length === 0) {
      rows.push({
        InvoiceNumber: s.invoiceNumber,
        Date: s.date.toISOString().split('T')[0],
        Customer: customerName,
        Product: '',
        SKU: '',
        Quantity: 0,
        UnitPrice: 0,
        Subtotal: 0,
        CostPrice: 0,
        TotalAmount: toNumber(s.totalAmount),
        TotalCost: toNumber(s.totalCost),
        Profit: toNumber(s.profit),
        Discount: toNumber(s.discountAmount),
        PaymentMethod: s.paymentMethod || '',
        Channel: s.channel || '',
        Status: s.status,
        Notes: s.notes || '',
      });
    } else {
      for (const item of s.items) {
        rows.push({
          InvoiceNumber: s.invoiceNumber,
          Date: s.date.toISOString().split('T')[0],
          Customer: customerName,
          Product: item.product.name,
          SKU: item.product.sku || '',
          Quantity: item.quantity,
          UnitPrice: toNumber(item.salePrice),
          Subtotal: toNumber(item.subtotal),
          CostPrice: toNumber(item.costPrice),
          TotalAmount: toNumber(s.totalAmount),
          TotalCost: toNumber(s.totalCost),
          Profit: toNumber(s.profit),
          Discount: toNumber(s.discountAmount),
          PaymentMethod: s.paymentMethod || '',
          Channel: s.channel || '',
          Status: s.status,
          Notes: s.notes || '',
        });
      }
    }
  }

  return rows;
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
      deletedAt: null,
      date: { gte: start, lte: end },
    },
    select: {
      date: true,
      description: true,
      category: true,
      amount: true,
      receiptUrl: true,
    },
    orderBy: { date: 'asc' },
  });

  return expenses.map(e => ({
    Date: e.date.toISOString().split('T')[0],
    Description: e.description || '',
    Category: e.category || '',
    Amount: toNumber(e.amount),
    HasReceipt: e.receiptUrl ? 'Yes' : 'No',
  }));
}
