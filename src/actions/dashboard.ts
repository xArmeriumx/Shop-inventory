"use server";

import { requirePermission } from "@/lib/auth-guard";
import { DashboardService } from "@/services";

export async function getDashboardStats() {
  const ctx = await requirePermission("SALE_VIEW");
  return DashboardService.getDashboardStats(ctx);
}

export async function getMonthlyStats() {
  const ctx = await requirePermission("SALE_VIEW");
  return DashboardService.getMonthlyStats(ctx);
}

export async function getSalesChartData(days = 7) {
  const ctx = await requirePermission("SALE_VIEW");
  return DashboardService.getSalesChartData(days, ctx);
}
