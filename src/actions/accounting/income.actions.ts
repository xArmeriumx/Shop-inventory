'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { incomeSchema, type IncomeInput } from '@/schemas/accounting/income.schema';
import { FinanceService } from '@/services';
import { GetFinanceParams } from '@/types/domain';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

export async function getIncomes(params: GetFinanceParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
      return FinanceService.getIncomes(params, ctx);
    }, 'accounting:getIncomes');
  }, { context: { action: 'getIncomes' } });
}

export async function getIncome(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
      return FinanceService.getIncomeById(id, ctx);
    }, 'accounting:getIncome');
  }, { context: { action: 'getIncome', id } });
}

export async function createIncome(input: IncomeInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_CONFIG' as any);
      const validated = incomeSchema.parse(input);
      const income = await FinanceService.createIncome(validated, ctx);
      revalidatePath('/incomes');
      revalidatePath('/dashboard');
      return income;
    }, 'accounting:createIncome');
  }, { context: { action: 'createIncome' } });
}

export async function updateIncome(id: string, input: IncomeInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_CONFIG' as any);
      const validated = incomeSchema.parse(input);
      const income = await FinanceService.updateIncome(id, validated, ctx);
      revalidatePath('/incomes');
      revalidatePath(`/incomes/${id}`);
      return income;
    }, 'accounting:updateIncome');
  }, { context: { action: 'updateIncome' } });
}

export async function deleteIncome(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_CONFIG');
      await FinanceService.deleteIncome(id, ctx);
      revalidatePath('/incomes');
      revalidatePath('/dashboard');
      return null;
    }, 'accounting:deleteIncome');
  }, { context: { action: 'deleteIncome', id } });
}

export async function getMonthlyIncomes(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
      return FinanceService.getMonthlyIncomes(ctx);
    }, 'accounting:getMonthlyIncomes');
  }, { context: { action: 'getMonthlyIncomes' } });
}
