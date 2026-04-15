'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ExportService } from '@/services';
import type { RequestContext } from '@/types/domain';
export async function exportProductsData() {
  const ctx = await requirePermission('PRODUCT_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportProductsData(ctx);
}

export async function exportPurchasesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('PURCHASE_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportPurchasesData(startDate, endDate, ctx);
}

export async function exportReturnsData(startDate: string, endDate: string) {
  const ctx = await requirePermission('RETURN_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportReturnsData(startDate, endDate, ctx);
}

export async function exportCustomersData() {
  const ctx = await requirePermission('CUSTOMER_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportCustomersData(ctx);
}

export async function exportIncomesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('INCOME_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportIncomesData(startDate, endDate, ctx);
}

export async function exportSalesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES', { rateLimitPolicy: 'export' });
  return ExportService.exportSalesData(startDate, endDate, ctx);
}

export async function exportExpensesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('EXPENSE_VIEW', { rateLimitPolicy: 'export' });
  return ExportService.exportExpensesData(startDate, endDate, ctx);
}
