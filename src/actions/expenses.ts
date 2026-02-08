'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { expenseSchema, type ExpenseInput } from '@/schemas/expense';
import { toNumber } from '@/lib/money';

interface GetExpensesParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

//Get expenses (paginated)
export async function getExpenses(params: GetExpensesParams = {}) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  const { page = 1, limit = 20, search, category, startDate, endDate } = params;

  //Search filter

  const searchFilter = buildSearchFilter(search, ['description']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  //Where clause
  const where = {
    shopId: ctx.shopId,
    deletedAt: null,
    //dynamic where clause
    ...(searchFilter && searchFilter),
    ...(category && { category }),
    ...(dateFilter && { date: dateFilter }),
  };

  //Paginated query
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
      amount: toNumber(expense.amount),
    })),
  };
}


//get expense by id
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
    amount: toNumber(expense.amount),
  };
}

//create expense
export async function createExpense(input: ExpenseInput) {
  // RBAC: Require EXPENSE_CREATE permission
  const ctx = await requirePermission('EXPENSE_CREATE');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
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
    revalidatePath('/dashboard'); //update dashboard stats
    return { 
      success: true,
      data: {
        ...expense,
        amount: Number(expense.amount)
      } 
    };
  } catch (error) {
    await logger.error('Create expense error', error as Error, { path: 'createExpense', userId: ctx.userId });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}


//update expense (edit)
export async function updateExpense(id: string, input: ExpenseInput) {
  // RBAC: Require EXPENSE_EDIT permission
  const ctx = await requirePermission('EXPENSE_EDIT');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  //check if expense exists - RBAC: Use shopId for multi-tenant isolation
  const existing = await db.expense.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return { success: false, error: { _form: ['ไม่พบข้อมูลค่าใช้จ่าย'] } };
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
      success: true,
      data: {
        ...expense,
        amount: Number(expense.amount)
      } 
    };
  } catch (error) {
    await logger.error('Update expense error', error as Error, { path: 'updateExpense', userId: ctx.userId, expenseId: id });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

//delete expense (soft delete)  
export async function deleteExpense(id: string) {
  // RBAC: Require EXPENSE_DELETE permission
  const ctx = await requirePermission('EXPENSE_DELETE');

  // RBAC: Use shopId for multi-tenant isolation
  const existing = await db.expense.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return { success: false, message: 'ไม่พบข้อมูลค่าใช้จ่าย' };
  }

  try {
    // Soft Delete: Set deletedAt instead of hard delete
    await db.expense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, message: 'ลบค่าใช้จ่ายสำเร็จ' };
  } catch (error) {
    await logger.error('Delete expense error', error as Error, { path: 'deleteExpense', userId: ctx.userId, expenseId: id });
    return { success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

// get monthly expenses (summary monthly expenses)
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
    total: toNumber(result._sum.amount),
    count: result._count,
  };
}
