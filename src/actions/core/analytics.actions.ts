'use server';

import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { ReportService } from '@/services';

import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

/**
 * Fetch categorized product velocity intelligence
 */
export async function getInventoryIntelligence(windowDays: number = 30): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return await ReportService.getInventoryIntelligence(windowDays, ctx);
    }, 'analytics:getInventoryIntelligence');
  }, { context: { action: 'getInventoryIntelligence', windowDays } });
}

/**
 * Fetch procurement lead distance and supplier aging
 */
export async function getProcurementAging(limit: number = 20): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return await ReportService.getProcurementAging(limit, ctx);
    }, 'analytics:getProcurementAging');
  }, { context: { action: 'getProcurementAging', limit } });
}

/**
 * Fetch sales activity heatmap (Category vs Time)
 */
export async function getSalesHeatmap(windowDays: number = 30): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return await ReportService.getSalesHeatmap(windowDays, ctx);
    }, 'analytics:getSalesHeatmap');
  }, { context: { action: 'getSalesHeatmap', windowDays } });
}

/**
 * Fetch smart reorder suggestions based on velocity and lead times
 */
export async function getReorderSuggestions(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('REPORT_VIEW_SALES');
      return await ReportService.getReorderSuggestions(ctx);
    }, 'analytics:getReorderSuggestions');
  }, { context: { action: 'getReorderSuggestions' } });
}
