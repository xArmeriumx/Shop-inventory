'use server';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { ReportService, type ReportData } from '@/services';
import { ActionResponse } from '@/types/common';

// Note: Re-exporting models from service to avoid changing client side usage
export type { ReportData };

export async function getReportData(startDate?: string, endDate?: string): Promise<ActionResponse<ReportData>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getReportData(startDate, endDate, ctx);
    });
  }, { context: { action: 'getReportData' } });
}

export async function getTopProducts(startDate?: string, endDate?: string, limit = 10): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getTopProducts(startDate, endDate, limit, ctx);
    }, 'purchases:getTopProducts');
  }, { context: { action: 'getTopProducts' } });
}

export async function getProfitByProduct(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getProfitByProduct(startDate, endDate, ctx);
    });
  }, { context: { action: 'getProfitByProduct' } });
}

export async function getComparisonReport(
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string,
): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getComparisonReport(period1Start, period1End, period2Start, period2End, ctx);
    });
  }, { context: { action: 'getComparisonReport' } });
}

export async function getStockValueReport(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return ReportService.getStockValueReport(ctx);
    });
  }, { context: { action: 'getStockValueReport' } });
}

export async function getInventoryTurnover(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getInventoryTurnover(startDate, endDate, ctx);
    });
  }, { context: { action: 'getInventoryTurnover' } });
}

export async function getSalesByCategory(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getSalesByCategory(startDate, endDate, ctx);
    });
  }, { context: { action: 'getSalesByCategory' } });
}

export async function getProfitLossReport(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getProfitLossReport(startDate, endDate, ctx);
    });
  }, { context: { action: 'getProfitLossReport' } });
}

export async function getExpenseByCategoryReport(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('EXPENSE_VIEW');
      return ReportService.getExpenseByCategoryReport(startDate, endDate, ctx);
    });
  }, { context: { action: 'getExpenseByCategoryReport' } });
}

export async function getSalesChannelReport(startDate?: string, endDate?: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return ReportService.getSalesChannelReport(startDate, endDate, ctx);
    });
  }, { context: { action: 'getSalesChannelReport' } });
}

export async function getCustomerRankingReport(
  startDate?: string,
  endDate?: string,
  limit = 20,
) {
  return PerformanceCollector.run(async () => {
    const ctx = await requirePermission('CUSTOMER_VIEW');
    return ReportService.getCustomerRankingReport(startDate, endDate, limit, ctx);
  });
}