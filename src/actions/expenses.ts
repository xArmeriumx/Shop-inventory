'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
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
  const userId = await getCurrentUserId();
  const { page = 1, limit = 20, search, category, startDate, endDate } = params;

  const searchFilter = buildSearchFilter(search, ['description', 'notes']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  const where = {
    userId,
    ...(searchFilter && searchFilter),
    ...(category && { category }),
    ...(dateFilter && { date: dateFilter }),
  };

  return paginatedQuery(db.expense, {
    where,
    page,
    limit,
    orderBy: { date: 'desc' },
  });
}

export async function getExpense(id: string) {
  const userId = await getCurrentUserId();

  const expense = await db.expense.findFirst({
    where: { id, userId },
  });

  if (!expense) {
    throw new Error('ไม่พบข้อมูลค่าใช้จ่าย');
  }

  return expense;
}

export async function createExpense(input: ExpenseInput) {
  const userId = await getCurrentUserId();

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await db.expense.create({
      data: {
        ...validated.data,
        notes: validated.data.notes || null,
        userId,
      },
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { data: expense };
  } catch (error) {
    console.error('Create expense error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const userId = await getCurrentUserId();

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const existing = await db.expense.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { error: { _form: ['ไม่พบข้อมูลค่าใช้จ่าย'] } };
  }

  try {
    const expense = await db.expense.update({
      where: { id },
      data: {
        ...validated.data,
        notes: validated.data.notes || null,
      },
    });

    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);
    return { data: expense };
  } catch (error) {
    console.error('Update expense error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteExpense(id: string) {
  const userId = await getCurrentUserId();

  const existing = await db.expense.findFirst({
    where: { id, userId },
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
  const userId = await getCurrentUserId();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await db.expense.aggregate({
    where: {
      userId,
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
