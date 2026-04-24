'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { expenseSchema, type ExpenseInput } from '@/schemas/accounting/expense.schema';
import { FinanceService } from '@/services';
import { GetFinanceParams } from '@/types/domain';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

export async function getExpenses(params: GetFinanceParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_VIEW');
      return FinanceService.getExpenses(params, ctx);
    }, 'accounting:getExpenses');
  }, { context: { action: 'getExpenses' } });
}

export async function getExpense(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_VIEW');
      return FinanceService.getExpenseById(id, ctx);
    }, 'accounting:getExpense');
  }, { context: { action: 'getExpense', id } });
}

export async function createExpense(input: ExpenseInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_CREATE');
      const validated = expenseSchema.parse(input);
      const expense = await FinanceService.createExpense(validated, ctx);
      revalidatePath('/expenses');
      revalidatePath('/dashboard');
      return expense;
    }, 'accounting:createExpense');
  }, { context: { action: 'createExpense' } });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_UPDATE');
      const validated = expenseSchema.parse(input);
      const expense = await FinanceService.updateExpense(id, validated, ctx);
      revalidatePath('/expenses');
      revalidatePath(`/expenses/${id}`);
      return expense;
    }, 'accounting:updateExpense');
  }, { context: { action: 'updateExpense' } });
}

export async function deleteExpense(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_DELETE');
      await FinanceService.deleteExpense(id, ctx);
      revalidatePath('/expenses');
      revalidatePath('/dashboard');
      return null;
    }, 'accounting:deleteExpense');
  }, { context: { action: 'deleteExpense', id } });
}

export async function getMonthlyExpenses(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_VIEW');
      return FinanceService.getMonthlyExpenses(ctx);
    }, 'accounting:getMonthlyExpenses');
  }, { context: { action: 'getMonthlyExpenses' } });
}
