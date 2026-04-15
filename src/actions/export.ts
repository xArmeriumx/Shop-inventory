'use server';

import { requirePermission } from '@/lib/auth-guard';
import { ExportService } from '@/services';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import type { RequestContext } from '@/types/domain';

async function enforceExportLimit(ctx: RequestContext) {
  const rlResult = await checkRateLimit(rateLimiters.export, `shop:${ctx.shopId}:export`, ctx, 'EXPORT_REPORT');
  if (!rlResult.success) {
    throw new Error('เรียกใช้งาน Export บ่อยเกินไป กรุณารอสักครู่ (จำกัด 2 ครั้ง/นาที)');
  }
}

export async function exportProductsData() {
  const ctx = await requirePermission('PRODUCT_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportProductsData(ctx);
}

export async function exportPurchasesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportPurchasesData(startDate, endDate, ctx);
}

export async function exportReturnsData(startDate: string, endDate: string) {
  const ctx = await requirePermission('RETURN_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportReturnsData(startDate, endDate, ctx);
}

export async function exportCustomersData() {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportCustomersData(ctx);
}

export async function exportIncomesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('INCOME_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportIncomesData(startDate, endDate, ctx);
}

export async function exportSalesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  await enforceExportLimit(ctx);
  return ExportService.exportSalesData(startDate, endDate, ctx);
}

export async function exportExpensesData(startDate: string, endDate: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  await enforceExportLimit(ctx);
  return ExportService.exportExpensesData(startDate, endDate, ctx);
}
