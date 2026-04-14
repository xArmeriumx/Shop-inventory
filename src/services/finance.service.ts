import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';
import { IncomeInput } from '@/schemas/income';
import { ExpenseInput } from '@/schemas/expense';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { toNumber } from '@/lib/money';

export interface GetFinanceParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export const FinanceService = {
  // ============================================================================
  // INCOMES
  // ============================================================================
  async getIncomes(params: GetFinanceParams = {}, ctx: RequestContext) {
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

    const result = await paginatedQuery(db.income as any, {
      where,
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((income: any) => ({
        ...income,
        amount: toNumber(income.amount),
      })),
    };
  },

  async getIncomeById(id: string, ctx: RequestContext) {
    const income = await (db as any).income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!income) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    return { ...income, amount: toNumber(income.amount) };
  },

  async createIncome(data: IncomeInput, ctx: RequestContext) {
    return (db as any).income.create({
      data: {
        ...data,
        userId: ctx.userId,
        shopId: ctx.shopId,
      },
    });
  },

  async updateIncome(id: string, data: IncomeInput, ctx: RequestContext) {
    const existing = await (db as any).income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    return (db as any).income.update({
      where: { id },
      data,
    });
  },

  async deleteIncome(id: string, ctx: RequestContext) {
    const existing = await (db as any).income.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลรายรับ');

    return (db as any).income.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async getMonthlyIncomes(ctx: RequestContext) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await (db as any).income.aggregate({
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
  async getExpenses(params: GetFinanceParams = {}, ctx: RequestContext) {
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
      data: result.data.map((expense: any) => ({
        ...expense,
        amount: toNumber(expense.amount),
      })),
    };
  },

  async getExpenseById(id: string, ctx: RequestContext) {
    const expense = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!expense) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    return { ...expense, amount: toNumber(expense.amount) };
  },

  async createExpense(data: ExpenseInput, ctx: RequestContext) {
    return db.expense.create({
      data: {
        ...data,
        userId: ctx.userId,
        shopId: ctx.shopId,
      },
    });
  },

  async updateExpense(id: string, data: ExpenseInput, ctx: RequestContext) {
    const existing = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    return db.expense.update({
      where: { id },
      data,
    });
  },

  async deleteExpense(id: string, ctx: RequestContext) {
    const existing = await db.expense.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูลค่าใช้จ่าย');

    return db.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async getMonthlyExpenses(ctx: RequestContext) {
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
  }
};
