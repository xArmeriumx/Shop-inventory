'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { incomeSchema, type IncomeInput } from '@/schemas/income';
import { FinanceService, GetFinanceParams, ServiceError } from '@/services';

export async function getIncomes(params: GetFinanceParams = {}) {
  const ctx = await requirePermission('INCOME_VIEW');
  return FinanceService.getIncomes(params, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function getIncome(id: string) {
  const ctx = await requirePermission('INCOME_VIEW');
  try {
    return await FinanceService.getIncomeById(id, { userId: ctx.userId, shopId: ctx.shopId });
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

export async function createIncome(input: IncomeInput) {
  const ctx = await requirePermission('INCOME_CREATE');

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const income = await FinanceService.createIncome(validated.data, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { 
      success: true,
      data: {
        ...income,
        amount: Number(income.amount)
      } 
    };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Create income error', typedError, { path: 'createIncome', userId: ctx.userId });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function updateIncome(id: string, input: IncomeInput) {
  const ctx = await requirePermission('INCOME_EDIT');

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const income = await FinanceService.updateIncome(id, validated.data, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/incomes');
    revalidatePath(`/incomes/${id}`);
    return { 
      success: true,
      data: {
        ...income,
        amount: Number(income.amount)
      } 
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, error: { _form: [error.message] } };
    const typedError = error as Error;
    await logger.error('Update income error', typedError, { path: 'updateIncome', userId: ctx.userId, incomeId: id });
    return { success: false, error: { _form: ['เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'] } };
  }
}

export async function deleteIncome(id: string) {
  const ctx = await requirePermission('INCOME_DELETE');

  try {
    await FinanceService.deleteIncome(id, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { success: true, message: 'ลบรายรับสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Delete income error', typedError, { path: 'deleteIncome', userId: ctx.userId, incomeId: id });
    return { success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function getMonthlyIncomes() {
  const ctx = await requirePermission('INCOME_VIEW');
  return FinanceService.getMonthlyIncomes({ userId: ctx.userId, shopId: ctx.shopId });
}
