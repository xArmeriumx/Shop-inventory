'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { expenseSchema, type ExpenseInput } from '@/schemas/expense';
import { FinanceService, ServiceError } from '@/services';
import { GetFinanceParams } from '@/types/domain';

export async function getExpenses(params: GetFinanceParams = {}) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return FinanceService.getExpenses(params, ctx);
}

export async function getExpense(id: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  try {
    return await FinanceService.getExpenseById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

export async function createExpense(input: ExpenseInput) {
  const ctx = await requirePermission('EXPENSE_CREATE');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await FinanceService.createExpense(validated.data, ctx) as Record<string, any>;
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return {
      success: true,
      data: {
        ...expense,
        amount: Number(expense.amount)
      }
    };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Create expense error', typedError, { path: 'createExpense', userId: ctx.userId });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const ctx = await requirePermission('EXPENSE_EDIT');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await FinanceService.updateExpense(id, validated.data, ctx) as Record<string, any>;
    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);
    return {
      success: true,
      data: {
        ...expense,
        amount: Number(expense.amount)
      }
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, error: { _form: [error.message] } };
    const typedError = error as Error;
    await logger.error('Update expense error', typedError, { path: 'updateExpense', userId: ctx.userId, expenseId: id });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteExpense(id: string) {
  const ctx = await requirePermission('EXPENSE_DELETE');

  try {
    await FinanceService.deleteExpense(id, ctx);
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, message: 'ลบค่าใช้จ่ายสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Delete expense error', typedError, { path: 'deleteExpense', userId: ctx.userId, expenseId: id });
    return { success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function getMonthlyExpenses() {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return FinanceService.getMonthlyExpenses(ctx);
}
