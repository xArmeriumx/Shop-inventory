"use server";

import { requirePermission } from "@/lib/auth-guard";
import { DashboardService } from "@/services";
import { logger } from "@/lib/logger";
import { isDynamicServerError } from "@/lib/next-utils";

/**
 * Get core dashboard statistics
 * Contract: Returns a full stats object even on failure (Selective UI hardening)
 */
export async function getDashboardStats() {
  try {
    const ctx = await requirePermission("SALE_VIEW");
    return await DashboardService.getDashboardStats(ctx);
  } catch (error) {
    if (!isDynamicServerError(error) && !(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('[Action: getDashboardStats] Failed:', error);
    }
    
    // Return safe default shape for UI
    return {
      todaySales: { revenue: 0, salesRevenue: 0, incomeRevenue: 0, profit: 0, count: 0, incomeCount: 0 },
      totalProducts: 0,
      lowStockCount: 0,
      recentSales: [],
      lowStockProducts: [],
      pendingPayments: { count: 0, amount: 0 },
      pendingShipments: 0,
      todayExpenses: { total: 0, count: 0 },
      stockValue: { total: 0, itemCount: 0 }
    };
  }
}

/**
 * Get monthly summary stats
 */
export async function getMonthlyStats() {
  try {
    const ctx = await requirePermission("SALE_VIEW");
    return await DashboardService.getMonthlyStats(ctx);
  } catch (error) {
    if (!isDynamicServerError(error) && !(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('[Action: getMonthlyStats] Failed:', error);
    }
    
    return { 
      revenue: 0, 
      salesRevenue: 0, 
      incomeRevenue: 0, 
      profit: 0, 
      count: 0, 
      incomeCount: 0 
    };
  }
}

/**
 * Get sales chart data
 */
export async function getSalesChartData(days = 7) {
  try {
    const ctx = await requirePermission("SALE_VIEW");
    return await DashboardService.getSalesChartData(days, ctx);
  } catch (error) {
    if (!isDynamicServerError(error) && !(error instanceof Error && error.message.includes('NEXT_REDIRECT'))) {
      console.error('[Action: getSalesChartData] Failed:', error);
    }
    return [];
  }
}

