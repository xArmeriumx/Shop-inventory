'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { incomeSchema, type IncomeInput } from '@/schemas/income';

interface GetIncomesParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Get incomes (paginated)
 */
export async function getIncomes(params: GetIncomesParams = {}) {
  const ctx = await requirePermission('INCOME_VIEW');
  const { page = 1, limit = 20, search, category, startDate, endDate } = params;

  // Search filter
  const searchFilter = buildSearchFilter(search, ['description']);
  const dateFilter = buildDateRangeFilter(startDate, endDate);

  // Where clause
  const where = {
    shopId: ctx.shopId,
    deletedAt: null,
    ...(searchFilter && searchFilter),
    ...(category && { category }),
    ...(dateFilter && { date: dateFilter }),
  };

  // Paginated query
  const result = await paginatedQuery(db.income, {
    where,
    page,
    limit,
    orderBy: { date: 'desc' },
  });

  return {
    ...result,
    data: result.data.map((income: any) => ({
      ...income,
      amount: Number(income.amount),
    })),
  };
}

/**
 * Get income by id
 */
export async function getIncome(id: string) {
  const ctx = await requirePermission('INCOME_VIEW');

  const income = await db.income.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!income) {
    throw new Error('ไม่พบข้อมูลรายรับ');
  }

  return {
    ...income,
    amount: Number(income.amount),
  };
}

/**
 * Create income
 */
export async function createIncome(input: IncomeInput) {
  // RBAC: Require INCOME_CREATE permission
  const ctx = await requirePermission('INCOME_CREATE');

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const income = await db.income.create({
      data: {
        ...validated.data,
        userId: ctx.userId,
        shopId: ctx.shopId,
      },
    });

    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { 
      data: {
        ...income,
        amount: Number(income.amount)
      } 
    };
  } catch (error) {
    console.error('Create income error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

/**
 * Update income (edit)
 */
export async function updateIncome(id: string, input: IncomeInput) {
  // RBAC: Require INCOME_EDIT permission
  const ctx = await requirePermission('INCOME_EDIT');

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Check if income exists and belongs to shop
  const existing = await db.income.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return { error: { _form: ['ไม่พบข้อมูลรายรับ'] } };
  }

  try {
    const income = await db.income.update({
      where: { id },
      data: {
        ...validated.data,
      },
    });

    revalidatePath('/incomes');
    revalidatePath(`/incomes/${id}`);
    return { 
      data: {
        ...income,
        amount: Number(income.amount)
      } 
    };
  } catch (error) {
    console.error('Update income error:', error);
    return { error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

/**
 * Delete income (soft delete)
 */
export async function deleteIncome(id: string) {
  // RBAC: Require INCOME_DELETE permission
  const ctx = await requirePermission('INCOME_DELETE');

  const existing = await db.income.findFirst({
    where: { id, shopId: ctx.shopId, deletedAt: null },
  });

  if (!existing) {
    return { error: 'ไม่พบข้อมูลรายรับ' };
  }

  try {
    await db.income.delete({
      where: { id },
    });

    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Delete income error:', error);
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

/**
 * Get monthly incomes (summary for dashboard)
 */
export async function getMonthlyIncomes() {
  const ctx = await requirePermission('INCOME_VIEW');
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await db.income.aggregate({
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
