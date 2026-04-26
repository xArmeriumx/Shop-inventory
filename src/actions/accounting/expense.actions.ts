'use server';

import { revalidateTag } from 'next/cache';
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
      const result = await FinanceService.createExpense(validated, ctx);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return result.data;
    }, 'accounting:createExpense');
  }, { context: { action: 'createExpense' } });
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_UPDATE');
      const validated = expenseSchema.parse(input);
      const result = await FinanceService.updateExpense(id, validated, ctx);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return result.data;
    }, 'accounting:updateExpense');
  }, { context: { action: 'updateExpense' } });
}

export async function deleteExpense(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_DELETE');
      const result = await FinanceService.deleteExpense(id, ctx);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

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
