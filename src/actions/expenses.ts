'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { expenseSchema, type ExpenseInput } from '@/schemas/expense';
import { FinanceService } from '@/services';
import { GetFinanceParams } from '@/types/domain';
import { handleActionError } from '@/lib/error-handler';

export async function getExpenses(params: GetFinanceParams = {}) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return FinanceService.getExpenses(params, ctx);
}

export async function getExpense(id: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return FinanceService.getExpenseById(id, ctx);
}

export async function createExpense(input: ExpenseInput) {
  const ctx = await requirePermission('EXPENSE_CREATE');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await FinanceService.createExpense(validated.data, ctx);
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return { success: true, data: expense };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการบันทึกค่าใช้จ่าย', {
      path: 'createExpense',
      userId: ctx.userId
    });
  }
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const ctx = await requirePermission('EXPENSE_EDIT');

  const validated = expenseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const expense = await FinanceService.updateExpense(id, validated.data, ctx);
    revalidatePath('/expenses');
    revalidatePath(`/expenses/${id}`);
    return { success: true, data: expense };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการแก้ไขค่าใช้จ่าย', {
      path: 'updateExpense',
      userId: ctx.userId,
      expenseId: id
    });
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
    return handleActionError(error, 'เกิดข้อผิดพลาดในการลบค่าใช้จ่าย', {
      path: 'deleteExpense',
      userId: ctx.userId,
      expenseId: id
    });
  }
}

export async function getMonthlyExpenses() {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return FinanceService.getMonthlyExpenses(ctx);
}
