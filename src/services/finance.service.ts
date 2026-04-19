import { db } from '@/lib/db';
import { RequestContext, ServiceError, PaginatedResult, GetFinanceParams, SerializedIncome, SerializedExpense } from '@/types/domain';
import { AuditService } from './audit.service';
import { FINANCE_AUDIT_POLICIES } from './finance.policy';
import { IncomeInput } from '@/schemas/income';
import { ExpenseInput } from '@/schemas/expense';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { toNumber } from '@/lib/money';
import { FINANCE_CONSTANTS, serializeIncome, serializeExpense } from '@/lib/mappers';
import { IFinanceService } from '@/types/service-contracts';

export const FinanceService: IFinanceService = {
  // ============================================================================
  // INCOMES
  // ============================================================================
  async getIncomes(params: GetFinanceParams, ctx: RequestContext): Promise<PaginatedResult<SerializedIncome>> {
    const { page = 1, limit = 20, search, category, startDate, endDate } = params;
    const searchFilter = buildSearchFilter(search, ['description']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      deletedAt: null,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
      ...(dateFilter && { date: dateFilter }),
    };

    const result = await paginatedQuery(db.income, {
      where,
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map(serializeIncome),
    };
  },

  async getIncomeById(id: string, ctx: RequestContext): Promise<SerializedIncome> {
    const income = await db.income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!income) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    return serializeIncome(income);
  },

  async createIncome(data: IncomeInput, ctx: RequestContext): Promise<SerializedIncome> {
    const income = await AuditService.runWithAudit(
      ctx,
      FINANCE_AUDIT_POLICIES.INCOME_CREATE(data.description || ''),
      async () => {
        return db.income.create({
          data: {
            ...data,
            userId: ctx.userId,
            shopId: ctx.shopId,
          },
        });
      }
    );

    return serializeIncome(income);
  },

  async updateIncome(id: string, data: IncomeInput, ctx: RequestContext): Promise<SerializedIncome> {
    const existing = await db.income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    const updated = await AuditService.runWithAudit(
      ctx,
      {
        ...FINANCE_AUDIT_POLICIES.INCOME_UPDATE(id, existing.description || ''),
        beforeSnapshot: () => existing,
        afterSnapshot: () => db.income.findFirst({ where: { id } }),
      },
      async () => {
        return db.income.update({
          where: { id },
          data,
        });
      }
    );

    return serializeIncome(updated);
  },

  async deleteIncome(id: string, ctx: RequestContext): Promise<void> {
    const existing = await db.income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    await AuditService.runWithAudit(
      ctx,
      {
        ...FINANCE_AUDIT_POLICIES.INCOME_DELETE(id, existing.description || ''),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.income.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );
  },

  async getMonthlyIncomes(ctx: RequestContext): Promise<{ total: number; count: number }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await db.income.aggregate({
      where: {
        shopId: ctx.shopId,
        deletedAt: null,
        date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total: toNumber(result._sum?.amount),
      count: result._count,
    };
  },

  // ============================================================================
  // EXPENSES
  // ============================================================================
  async getExpenses(params: GetFinanceParams, ctx: RequestContext): Promise<PaginatedResult<SerializedExpense>> {
    const { page = 1, limit = 20, search, category, startDate, endDate } = params;
    const searchFilter = buildSearchFilter(search, ['description']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      deletedAt: null,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
      ...(dateFilter && { date: dateFilter }),
    };

    const result = await paginatedQuery(db.expense, {
      where,
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map(serializeExpense),
    };
  },

  async getExpenseById(id: string, ctx: RequestContext): Promise<SerializedExpense> {
    const expense = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!expense) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    return serializeExpense(expense);
  },

  async createExpense(data: ExpenseInput, ctx: RequestContext): Promise<SerializedExpense> {
    const expense = await AuditService.runWithAudit(
      ctx,
      FINANCE_AUDIT_POLICIES.EXPENSE_CREATE(data.description || ''),
      async () => {
        return db.expense.create({
          data: {
            ...data,
            userId: ctx.userId,
            shopId: ctx.shopId,
          },
        });
      }
    );

    return serializeExpense(expense);
  },

  async updateExpense(id: string, data: ExpenseInput, ctx: RequestContext): Promise<SerializedExpense> {
    const existing = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    const updated = await AuditService.runWithAudit(
      ctx,
      {
        ...FINANCE_AUDIT_POLICIES.EXPENSE_UPDATE(id, existing.description || ''),
        beforeSnapshot: () => existing,
        afterSnapshot: () => db.expense.findFirst({ where: { id } }),
      },
      async () => {
        return db.expense.update({
          where: { id },
          data,
        });
      }
    );

    return serializeExpense(updated);
  },

  async deleteExpense(id: string, ctx: RequestContext): Promise<void> {
    const existing = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    await AuditService.runWithAudit(
      ctx,
      {
        ...FINANCE_AUDIT_POLICIES.EXPENSE_DELETE(id, existing.description || ''),
        beforeSnapshot: () => existing,
      },
      async () => {
        await db.expense.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    );
  },

  async getMonthlyExpenses(ctx: RequestContext): Promise<{ total: number; count: number }> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        deletedAt: null,
        date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total: toNumber(result._sum?.amount),
      count: result._count,
    };
  },

  // ============================================================================
  // BILLING & TAX (ERP Module 6)
  // ============================================================================

  async markAsBilled(saleId: string, ctx: RequestContext): Promise<void> {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
    });

    if (!sale) throw new ServiceError('ไม่พบรายการขาย');

    // ERP Rule: Prevent duplicate billing
    if (sale.billingStatus === 'BILLED' || sale.billingStatus === 'PAID') {
      throw new ServiceError(`รายการนี้ถูกวางบิลไปแล้ว (สถานะ: ${sale.billingStatus})`);
    }

    await AuditService.runWithAudit(
      ctx,
      FINANCE_AUDIT_POLICIES.SALE_BILLING_MARK(sale.invoiceNumber),
      async () => {
        await db.sale.update({
          where: { id: saleId },
          data: { billingStatus: 'BILLED' },
        });
      }
    );
  },

  async generateTaxReport(params: { startDate: string, endDate: string }, ctx: RequestContext) {
    const dateFilter = buildDateRangeFilter(params.startDate, params.endDate);

    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        date: dateFilter,
        status: { not: 'CANCELLED' }
      },
      select: {
        invoiceNumber: true,
        netAmount: true,
        discountAmount: true,
        totalAmount: true,
        date: true
      }
    });

    // Standard calculation for VAT (ไทย)
    const reportData = sales.map(s => {
      const net = toNumber(s.netAmount);
      const vat = net * FINANCE_CONSTANTS.VAT_RATE / FINANCE_CONSTANTS.TAX_INCLUSIVE_DIVISOR;
      const amountBeforeVat = net - vat;

      return {
        date: s.date,
        invoiceNumber: s.invoiceNumber,
        total: net,
        vat: Number(vat.toFixed(2)),
        amountBeforeVat: Number(amountBeforeVat.toFixed(2)),
      };
    });

    return {
      period: `${params.startDate} to ${params.endDate}`,
      totalSales: reportData.reduce((sum, r) => sum + r.total, 0),
      totalVat: Number(reportData.reduce((sum, r) => sum + r.vat, 0).toFixed(2)),
      items: reportData
    };
  }
};
