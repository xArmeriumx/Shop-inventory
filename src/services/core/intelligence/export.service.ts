import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { toNumber } from '@/lib/money';
import { calculateCtn, getPurchaseStatusLabel, getSaleStatusLabel } from '@/lib/erp-utils';
import { ProfitAndLossDTO, BalanceSheetDTO, PartnerAgingDTO, PartnerStatementDTO } from '@/services/accounting/accounting-report.service';

export const ExportService = {
  /**
   * Universal CSV Renderer with UTF-8 BOM for Thai Excel support
   */
  toCSV(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const val = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = ('' + (val ?? '')).replace(/"/g, '""');
          return (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"'))
            ? `"${escaped}"`
            : escaped;
        }).join(',')
      )
    ];
    return '\uFEFF' + csvRows.join('\n'); // Add BOM
  },

  /**
   * Adapters: Transforming Reporting DTOs to Flat Rows (No Querying)
   */
  adaptProfitAndLossToRows(dto: ProfitAndLossDTO) {
    const rows: any[] = [];
    // Revenue Section
    dto.revenue.accounts.forEach(acc => {
      rows.push({ Type: 'REVENUE', Code: acc.code, Name: acc.name, Amount: acc.balance });
    });
    rows.push({ Type: 'TOTAL REVENUE', Code: '', Name: '', Amount: dto.revenue.total });

    // Spacer
    rows.push({});

    // Expense Section
    dto.expense.accounts.forEach(acc => {
      rows.push({ Type: 'EXPENSE', Code: acc.code, Name: acc.name, Amount: acc.balance });
    });
    rows.push({ Type: 'TOTAL EXPENSE', Code: '', Name: '', Amount: dto.expense.total });

    rows.push({});
    rows.push({ Type: 'NET PROFIT', Code: '', Name: '', Amount: dto.netProfit });

    return rows;
  },

  adaptBalanceSheetToRows(dto: BalanceSheetDTO) {
    const rows: any[] = [];
    const processGroup = (name: string, group: { accounts: any[], total: number }) => {
      rows.push({ Section: name, Code: '', Name: '', Amount: '' });
      group.accounts.forEach(acc => {
        rows.push({ Section: '', Code: acc.code, Name: acc.name, Amount: acc.balance });
      });
      rows.push({ Section: `Total ${name}`, Code: '', Name: '', Amount: group.total });
      rows.push({});
    };

    processGroup('ASSETS', dto.assets);
    processGroup('LIABILITIES', dto.liabilities);
    processGroup('EQUITY', dto.equity);

    rows.push({ Section: 'TOTAL LIABILITIES & EQUITY', Code: '', Name: '', Amount: dto.totalLiabilitiesAndEquity });
    rows.push({ Section: 'Status', Code: '', Name: dto.isBalanced ? 'BALANCED' : 'OUT OF BALANCE', Amount: '' });

    return rows;
  },

  adaptTrialBalanceToRows(data: any[]) {
    return data.map(acc => ({
      Code: acc.code,
      Name: acc.name,
      Category: acc.category,
      Debit: acc.totalDebit,
      Credit: acc.totalCredit,
      NetBalance: acc.balance
    }));
  },

  adaptAccountLedgerToRows(dto: any) {
    return dto.lines.map((l: any) => ({
      Date: new Date(l.date).toLocaleDateString('en-GB'), // DD/MM/YYYY
      RefNo: l.entryNo,
      Description: l.description,
      Debit: l.debit,
      Credit: l.credit,
      RunningBalance: l.balance,
      DocType: l.docType || '',
      SourceID: l.sourceId || ''
    }));
  },

  adaptAgingReportToRows(dto: any) {
    return dto.partners.map((p: any) => ({
      Partner: p.partnerName,
      Current: p.buckets.current,
      '1-30 Days': p.buckets.days30,
      '31-60 Days': p.buckets.days60,
      '61-90 Days': p.buckets.days90,
      'Over 90 Days': p.buckets.daysOver90,
      Total: p.buckets.total
    }));
  },

  adaptVatReportToRows(data: any[]) {
    return data.map(entry => ({
      Date: new Date(entry.vendorDocDate).toLocaleDateString('en-GB'),
      InvoiceNo: entry.vendorDocNo,
      Partner: entry.partnerName,
      TaxID: entry.partnerTaxId || '',
      Amount: entry.taxableBaseAmount,
      VAT: entry.taxAmount,
      Total: entry.taxableBaseAmount + entry.taxAmount,
      Status: entry.postingStatus === 'POSTED' ? 'สำเร็จ' : 'ยกเลิก'
    }));
  },

  adaptWhtReportToRows(data: any[]) {
    return data.map(entry => ({
      Date: new Date(entry.paymentDate).toLocaleDateString('en-GB'),
      Payee: entry.payeeNameSnapshot,
      TaxID: entry.payeeTaxIdSnapshot,
      Category: entry.incomeCategorySnapshot,
      Rate: `${entry.rateSnapshot}%`,
      BaseAmount: entry.whtBaseAmount,
      TaxAmount: entry.whtAmount,
      Form: entry.formTypeSnapshot
    }));
  },

  adaptGeneralLedgerToRows(data: any[]) {
    // Assume data is a list of journal entries with lines
    const rows: any[] = [];
    data.forEach(entry => {
      entry.lines.forEach((line: any) => {
        rows.push({
          Date: new Date(entry.date).toLocaleDateString('en-GB'),
          EntryNo: entry.entryNo,
          Description: entry.description,
          AccountCode: line.account.code,
          AccountName: line.account.name,
          Debit: line.debit,
          Credit: line.credit,
          Reference: entry.referenceNo || ''
        });
      });
    });
    return rows;
  },

  async exportProductsData(ctx: RequestContext) {
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
