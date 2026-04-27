"use server";

import { requirePermission } from "@/lib/auth-guard";
import { DashboardService, WarehouseService } from "@/services";
import { handleAction } from "@/lib/action-handler";
import { PerformanceCollector } from "@/lib/debug/measurement";

/**
 * Get core dashboard statistics
 * Contract: Returns a full stats object even on failure (Selective UI hardening)
 */
export async function getDashboardStats() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission("SALE_VIEW");
      
      // Auto-provision WH-MAIN for legacy shops if missing
      await WarehouseService.ensureDefaultWarehouse(ctx);

      const [stats, operational] = await Promise.all([
        DashboardService.getDashboardStats(ctx),
        DashboardService.getOperationalMetrics(ctx),
      ]);
      return { ...stats, operational };
    }, 'core:getDashboardStats');
  }, {
    context: { action: 'getDashboardStats' },
    // Dashboard is complex, we use handleAction but we should still be safe
  });
}

/**
 * Get monthly summary stats
 */
export async function getMonthlyStats() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission("SALE_VIEW" as any);
      return DashboardService.getMonthlyStats(ctx);
    }, 'core:getMonthlyStats');
  }, { context: { action: 'getMonthlyStats' } });
}

/**
 * Get sales chart data
 */
export async function getSalesChartData(days = 7) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission("SALE_VIEW" as any);
      return DashboardService.getSalesChartData(days, ctx);
    }, 'core:getSalesChartData');
  }, { context: { action: 'getSalesChartData', days } });
}

