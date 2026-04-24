'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ExportService } from '@/services';
import type { RequestContext } from '@/types/domain';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

export async function exportProductsData() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW', { rateLimitPolicy: 'export' });
      return ExportService.exportProductsData(ctx);
    }, 'core:exportProductsData');
  }, { skipSerialize: true });
}

export async function exportPurchasesData(startDate: string, endDate: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW', { rateLimitPolicy: 'export' });
      return ExportService.exportPurchasesData(startDate, endDate, ctx);
    }, 'core:exportPurchasesData');
  }, { skipSerialize: true });
}

export async function exportReturnsData(startDate: string, endDate: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('RETURN_VIEW', { rateLimitPolicy: 'export' });
      return ExportService.exportReturnsData(startDate, endDate, ctx);
    }, 'core:exportReturnsData');
  }, { skipSerialize: true });
}

export async function exportCustomersData() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('CUSTOMER_VIEW', { rateLimitPolicy: 'export' });
      return ExportService.exportCustomersData(ctx);
    }, 'core:exportCustomersData');
  }, { skipSerialize: true });
}

export async function exportIncomesData(startDate: string, endDate: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('INCOME_VIEW' as any, { rateLimitPolicy: 'export' });
      return ExportService.exportIncomesData(startDate, endDate, ctx);
    }, 'core:exportIncomesData');
  }, { skipSerialize: true });
}

export async function exportSalesData(startDate: string, endDate: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES', { rateLimitPolicy: 'export' });
      return ExportService.exportSalesData(startDate, endDate, ctx);
    }, 'core:exportSalesData');
  }, { skipSerialize: true });
}

export async function exportExpensesData(startDate: string, endDate: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_VIEW', { rateLimitPolicy: 'export' });
      return ExportService.exportExpensesData(startDate, endDate, ctx);
    }, 'core:exportExpensesData');
  }, { skipSerialize: true });
}
