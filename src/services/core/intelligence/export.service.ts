import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { toNumber } from '@/lib/money';
import { calculateCtn, getPurchaseStatusLabel, getSaleStatusLabel } from '@/lib/erp-utils';
import { toCSV } from '@/lib/csv/renderer';
import { CSVAdapters } from '@/lib/csv/adapters';
import { ProfitAndLossDTO, BalanceSheetDTO } from '@/services/accounting/statement.service';
import { Security } from '@/services/core/iam/security.service';
import { Permission } from '@prisma/client';

function requireExportPermission(ctx: RequestContext, basePerm: Permission) {
  Security.requirePermission(ctx, basePerm);
  Security.requirePermission(ctx, 'REPORT_EXPORT');
}

export const ExportService = {
  /**
   * Universal CSV Renderer with UTF-8 BOM for Thai Excel support
   */
  toCSV(data: any[]): string {
    return toCSV(data);
  },

  /**
   * Adapters: Transforming Reporting DTOs to Flat Rows (No Querying)
   * Delegate to pure lib adapters.
   */
  adaptProfitAndLossToRows(dto: ProfitAndLossDTO) {
    return CSVAdapters.profitAndLoss(dto);
  },

  adaptBalanceSheetToRows(dto: BalanceSheetDTO) {
    return CSVAdapters.balanceSheet(dto);
  },

  adaptTrialBalanceToRows(data: any[]) {
    return CSVAdapters.trialBalance(data);
  },

  adaptAccountLedgerToRows(dto: any) {
    return CSVAdapters.accountLedger(dto);
  },

  adaptAgingReportToRows(dto: any) {
    return CSVAdapters.agingReport(dto);
  },

  adaptVatReportToRows(data: any[]) {
    return CSVAdapters.vatReport(data);
  },

  adaptWhtReportToRows(data: any[]) {
    return CSVAdapters.whtReport(data);
  },

  adaptGeneralLedgerToRows(data: any[]) {
    return CSVAdapters.generalLedger(data);
  },

  async exportProductsData(ctx: RequestContext) {
    requireExportPermission(ctx, 'PRODUCT_VIEW');
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true },
      select: {
        name: true, sku: true, costPrice: true, salePrice: true,
        stock: true, minStock: true, isLowStock: true, category: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p: any) => ({
      Name: p.name,
      SKU: p.sku || '',
      Category: p.category || '',
      CostPrice: toNumber(p.costPrice),
      SellingPrice: toNumber(p.salePrice),
      Stock: p.stock,
      MinStock: p.minStock,
      LowStock: p.isLowStock ? 'Yes' : 'No',
    }));
  },

  async exportPurchasesData(startDate: string, endDate: string, ctx: RequestContext) {
    requireExportPermission(ctx, 'PURCHASE_VIEW');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const purchases = await db.purchase.findMany({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end } },
      select: {
        purchaseNumber: true, date: true, totalCost: true, status: true, notes: true,
        supplier: { select: { name: true } },
        docType: true,
        items: {
          select: {
            product: { select: { name: true } },
            quantity: true, costPrice: true, subtotal: true, packagingQty: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    const rows: any[] = [];
    for (const p of purchases) {
      if (p.items.length === 0) {
        rows.push({
          PurchaseNumber: p.purchaseNumber || '', Date: p.date.toISOString().split('T')[0],
          Supplier: p.supplier?.name || '', Product: '', Quantity: 0, CostPrice: 0, Subtotal: 0,
          TotalCost: toNumber(p.totalCost), Status: p.status || 'ACTIVE', Notes: p.notes || '',
        });
      } else {
        for (const item of p.items) {
          rows.push({
            PurchaseNumber: p.purchaseNumber || '', Date: p.date.toISOString().split('T')[0],
            Supplier: p.supplier?.name || '', Product: item.product.name, Quantity: item.quantity,
            PackagingQty: item.packagingQty || 1, CTN: calculateCtn(item.quantity, item.packagingQty || 1),
            CostPrice: toNumber(item.costPrice), Subtotal: toNumber(item.subtotal),
            TotalCost: toNumber(p.totalCost), Status: getPurchaseStatusLabel(p.status, p.docType as any), Notes: p.notes || '',
          });
        }
      }
    }
    return rows;
  },

  async exportReturnsData(startDate: string, endDate: string, ctx: RequestContext) {
    requireExportPermission(ctx, 'SALE_VIEW');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const returns = await db.return.findMany({
      where: { shopId: ctx.shopId, createdAt: { gte: start, lte: end } },
      select: {
        returnNumber: true, createdAt: true, reason: true, refundMethod: true, refundAmount: true,
        sale: { select: { invoiceNumber: true } },
        items: {
          select: {
            product: { select: { name: true } }, quantity: true, refundPerUnit: true, refundAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows: any[] = [];
    for (const r of returns) {
      if (r.items.length === 0) {
        rows.push({
          ReturnNumber: r.returnNumber, Date: r.createdAt.toISOString().split('T')[0],
          SaleInvoice: r.sale?.invoiceNumber || '', Reason: r.reason, Product: '', Quantity: 0,
          RefundPerUnit: 0, ItemRefund: 0, TotalRefund: toNumber(r.refundAmount), RefundMethod: r.refundMethod,
        });
      } else {
        for (const item of r.items) {
          rows.push({
            ReturnNumber: r.returnNumber, Date: r.createdAt.toISOString().split('T')[0],
            SaleInvoice: r.sale?.invoiceNumber || '', Reason: r.reason, Product: item.product.name,
            Quantity: item.quantity, RefundPerUnit: toNumber(item.refundPerUnit),
            ItemRefund: toNumber(item.refundAmount), TotalRefund: toNumber(r.refundAmount), RefundMethod: r.refundMethod,
          });
        }
      }
    }
    return rows;
  },

  async exportCustomersData(ctx: RequestContext) {
    requireExportPermission(ctx, 'CUSTOMER_VIEW');
    const customers = await db.customer.findMany({
      where: { shopId: ctx.shopId, deletedAt: null },
      select: {
        name: true, phone: true, email: true, address: true, taxId: true, notes: true, createdAt: true,
        _count: { select: { sales: true } },
      },
      orderBy: { name: 'asc' },
    });

    return customers.map((c: any) => ({
      Name: c.name, Phone: c.phone || '', Email: c.email || '', Address: c.address || '',
      TaxID: c.taxId || '', Notes: c.notes || '', TotalOrders: c._count.sales,
      RegisteredDate: c.createdAt.toISOString().split('T')[0],
    }));
  },

  async exportIncomesData(startDate: string, endDate: string, ctx: RequestContext) {
    requireExportPermission(ctx, 'FINANCE_VIEW_LEDGER');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const incomes = await (db as any).income.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, date: { gte: start, lte: end } },
      select: { date: true, description: true, category: true, amount: true },
      orderBy: { date: 'asc' },
    });

    return incomes.map((i: any) => ({
      Date: i.date.toISOString().split('T')[0], Description: i.description || '',
      Category: i.category || '', Amount: toNumber(i.amount),
    }));
  },

  async exportSalesData(startDate: string, endDate: string, ctx: RequestContext) {
    requireExportPermission(ctx, 'SALE_VIEW');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const sales = await db.sale.findMany({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      select: {
        invoiceNumber: true, date: true, customerName: true, customer: { select: { name: true } },
        paymentMethod: true, channel: true, status: true, totalAmount: true, totalCost: true,
        profit: true, discountAmount: true, notes: true,
        items: {
          select: {
            product: { select: { name: true, sku: true } }, quantity: true,
            salePrice: true, subtotal: true, costPrice: true, packagingQty: true,
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
          InvoiceNumber: s.invoiceNumber, Date: s.date.toISOString().split('T')[0], Customer: customerName,
          Product: '', SKU: '', Quantity: 0, UnitPrice: 0, Subtotal: 0, CostPrice: 0,
          TotalAmount: toNumber(s.totalAmount), TotalCost: toNumber(s.totalCost), Profit: toNumber(s.profit),
          Discount: toNumber(s.discountAmount), PaymentMethod: s.paymentMethod || '', Channel: s.channel || '',
          Status: s.status, Notes: s.notes || '',
        });
      } else {
        for (const item of s.items) {
          rows.push({
            InvoiceNumber: s.invoiceNumber, Date: s.date.toISOString().split('T')[0], Customer: customerName,
            Product: item.product.name, SKU: item.product.sku || '', Quantity: item.quantity,
            PackagingQty: item.packagingQty || 1, CTN: calculateCtn(item.quantity, item.packagingQty || 1),
            UnitPrice: toNumber(item.salePrice), Subtotal: toNumber(item.subtotal), CostPrice: toNumber(item.costPrice),
            TotalAmount: toNumber(s.totalAmount), TotalCost: toNumber(s.totalCost), Profit: toNumber(s.profit),
            Discount: toNumber(s.discountAmount), PaymentMethod: s.paymentMethod || '', Channel: s.channel || '',
            Status: getSaleStatusLabel(s.status), Notes: s.notes || '',
          });
        }
      }
    }
    return rows;
  },

  async exportExpensesData(startDate: string, endDate: string, ctx: RequestContext) {
    requireExportPermission(ctx, 'FINANCE_VIEW_LEDGER');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const expenses = await db.expense.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, date: { gte: start, lte: end } },
      select: { date: true, description: true, category: true, amount: true, receiptUrl: true },
      orderBy: { date: 'asc' },
    });

    return expenses.map((e: any) => ({
      Date: e.date.toISOString().split('T')[0], Description: e.description || '',
      Category: e.category || '', Amount: toNumber(e.amount), HasReceipt: e.receiptUrl ? 'Yes' : 'No',
    }));
  },

  async exportAuditLogsData(startDate: string, endDate: string, ctx: RequestContext, format: 'CSV' | 'JSON' = 'CSV') {
    requireExportPermission(ctx, 'AUDIT_VIEW');
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);

    const logs = await db.auditLog.findMany({
      where: {
        shopId: ctx.shopId,
        createdAt: { gte: start, lte: end }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (format === 'JSON') {
      return logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        status: log.status,
        actor: {
          id: log.actorUserId,
          name: log.actorName,
          email: log.actorEmail
        },
        target: {
          type: log.targetType,
          id: log.targetId
        },
        snapshots: {
          before: log.beforeSnapshot,
          after: log.afterSnapshot
        },
        changes: log.changedFields,
        context: {
          reason: log.reason,
          note: log.note
        }
      }));
    }

    // Flattened for CSV
    return logs.map(log => ({
      Timestamp: log.createdAt.toISOString(),
      Action: log.action,
      Status: log.status,
      Domain: log.targetType || '',
      TargetID: log.targetId || '',
      Actor: log.actorName || log.actorUserId || 'System',
      Notes: log.note || '',
      Reason: log.reason || '',
      Changes: (log.changedFields || []).join(', ')
    }));
  }
};
