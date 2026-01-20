'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { expenseSchema, type ExpenseInput } from '@/schemas/expense';

interface GetExpensesParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export async function getExpenses(params: GetExpensesParams = {}) {
  const ctx = await requirePermission('EXPENSE_VIEW');
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
    data: result.data.map(expense => ({
      ...expense,
      amount: Number(expense.amount),
    })),
  };
}

export async function getExpense(id: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');

  const expense = await db.expense.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!expense) {
    throw new Error('ไม่พบข้อมูลค่าใช้จ่าย');
  }

  return {
    ...expense,
    amount: Number(expense.amount),
  };
}

export async function createExpense(input: ExpenseInput) {
  // RBAC: Require EXPENSE_CREATE permission
  const ctx = await requirePermission('EXPENSE_CREATE');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await db.expense.create({
      data: {
        ...validated.data,
        userId: ctx.userId,
        shopId: ctx.shopId,  // RBAC: Set shopId for new expense
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { 
      data: {
        ...expense,
        amount: Number(expense.amount)
      } 
    };
  } catch (error) {
    console.error('Create expense error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateExpense(id: string, input: ExpenseInput) {
  // RBAC: Require EXPENSE_EDIT permission
  const ctx = await requirePermission('EXPENSE_EDIT');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const existing = await db.expense.findFirst({
    where: { id, userId: ctx.userId, deletedAt: null },
  });

  if (!existing) {
    return { error: { _form: ['ไม่พบข้อมูลค่าใช้จ่าย'] } };
  }

  try {
    const expense = await db.expense.update({
      where: { id },
      data: {
        ...validated.data,
      },
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);
    return { 
      data: {
        ...expense,
        amount: Number(expense.amount)
      } 
    };
  } catch (error) {
    console.error('Update expense error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteExpense(id: string) {
  // RBAC: Require EXPENSE_DELETE permission
  const ctx = await requirePermission('EXPENSE_DELETE');

  const existing = await db.expense.findFirst({
    where: { id, userId: ctx.userId, deletedAt: null },
  });

  if (!existing) {
    return { error: 'ไม่พบข้อมูลค่าใช้จ่าย' };
  }

  try {
    await db.expense.delete({
      where: { id },
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Delete expense error:', error);
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function getMonthlyExpenses() {
  const ctx = await requirePermission('EXPENSE_VIEW'); // Or DASHBOARD_VIEW
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await db.expense.aggregate({
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
      date: {
        gte: firstDayOfMonth,
        lt: firstDayOfNextMonth,
      },
    },
    _sum: { amount: true },
    _count: true,
  });

  return {
    total: Number(result._sum.amount || 0),
    count: result._count,
  };
}
