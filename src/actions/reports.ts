'use server';

import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { ReportService, ReportData } from '@/services';

// Note: Re-exporting models from service to avoid changing client side usage
export type { ReportData };

export async function getReportData(startDate?: string, endDate?: string): Promise<ReportData> {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  try {
    return await ReportService.getReportData(startDate, endDate, ctx);
  } catch (error: any) {
    await logger.error('Failed to generate report data', error, { path: 'getReportData', startDate, endDate });
    throw new Error('ไม่สามารถดึงข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง');
  }
}

export async function getTopProducts(startDate?: string, endDate?: string, limit = 10) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getTopProducts(startDate, endDate, limit, ctx);
}

export async function getProfitByProduct(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getProfitByProduct(startDate, endDate, ctx);
}

export async function getComparisonReport(
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string,
) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getComparisonReport(period1Start, period1End, period2Start, period2End, ctx);
}

export async function getStockValueReport() {
  const ctx = await requirePermission('PRODUCT_VIEW');
  return ReportService.getStockValueReport(ctx);
}

export async function getInventoryTurnover(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getInventoryTurnover(startDate, endDate, ctx);
}

export async function getSalesByCategory(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getSalesByCategory(startDate, endDate, ctx);
}

export async function getProfitLossReport(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getProfitLossReport(startDate, endDate, ctx);
}

export async function getExpenseByCategoryReport(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('EXPENSE_VIEW');
  return ReportService.getExpenseByCategoryReport(startDate, endDate, ctx);
}

export async function getSalesChannelReport(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  return ReportService.getSalesChannelReport(startDate, endDate, ctx);
}

export async function getCustomerRankingReport(
  startDate?: string,
  endDate?: string,
  limit = 20,
) {
  const ctx = await requirePermission('CUSTOMER_VIEW');
  return ReportService.getCustomerRankingReport(startDate, endDate, limit, ctx);
}