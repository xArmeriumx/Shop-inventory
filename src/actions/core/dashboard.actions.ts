"use server";

import { requirePermission } from "@/lib/auth-guard";
import { DashboardService, WarehouseService } from "@/services";
import { handleAction } from "@/lib/action-handler";
import { PerformanceCollector } from "@/lib/debug/measurement";

/**
 * Get core dashboard statistics (Shop-level — no warehouse filter)
 * Architecture Decision: Dashboard = Shop overview, Warehouse filter = Inventory pages
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
  });
}

/**
 * Get monthly summary stats (Shop-level)
 */
export async function getMonthlyStats() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission("SALE_VIEW");
      return DashboardService.getMonthlyStats(ctx);
    }, 'core:getMonthlyStats');
  }, { context: { action: 'getMonthlyStats' } });
}

/**
 * Get sales chart data (Shop-level)
 */
export async function getSalesChartData(days = 7) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission("SALE_VIEW");
      return DashboardService.getSalesChartData(days, ctx);
    }, 'core:getSalesChartData');
  }, { context: { action: 'getSalesChartData', days } });
}


