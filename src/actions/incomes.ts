'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { incomeSchema, type IncomeInput } from '@/schemas/income';
import { FinanceService } from '@/services';
import { GetFinanceParams } from '@/types/domain';
import { handleActionError } from '@/lib/error-handler';

export async function getIncomes(params: GetFinanceParams = {}) {
  const ctx = await requirePermission('INCOME_VIEW' as any);
  return FinanceService.getIncomes(params, ctx);
}

export async function getIncome(id: string) {
  const ctx = await requirePermission('INCOME_VIEW' as any);
  return FinanceService.getIncomeById(id, ctx);
}

export async function createIncome(input: IncomeInput) {
  const ctx = await requirePermission('INCOME_CREATE' as any);

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const income = await FinanceService.createIncome(validated.data, ctx);
    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { success: true, data: income };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการบันทึกรายรับ', {
      path: 'createIncome',
      userId: ctx.userId
    });
  }
}

export async function updateIncome(id: string, input: IncomeInput) {
  const ctx = await requirePermission('INCOME_UPDATE' as any);

  const validated = incomeSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.flatten().fieldErrors };
  }

  try {
    const income = await FinanceService.updateIncome(id, validated.data, ctx);
    revalidatePath('/incomes');
    revalidatePath(`/incomes/${id}`);
    return { success: true, data: income };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการแก้ไขรายรับ', {
      path: 'updateIncome',
      userId: ctx.userId,
      incomeId: id
    });
  }
}

export async function deleteIncome(id: string) {
  const ctx = await requirePermission('INCOME_DELETE' as any);

  try {
    await FinanceService.deleteIncome(id, ctx);
    revalidatePath('/incomes');
    revalidatePath('/dashboard');
    return { success: true, message: 'ลบรายรับสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการลบรายรับ', {
      path: 'deleteIncome',
      userId: ctx.userId,
      incomeId: id
    });
  }
}

export async function getMonthlyIncomes() {
  const ctx = await requirePermission('INCOME_VIEW' as any);
  return FinanceService.getMonthlyIncomes(ctx);
}
