/**
 * dashboard.service.ts — Public Facade
 * ============================================================================
 * Refactored into Domain-Driven Use Cases.
 */

import { DashboardStatsQuery } from './dashboard/stats.query';
import { DashboardOperationsQuery } from './dashboard/operations.query';
import { DashboardFinanceQuery } from './dashboard/finance.query';
import { DashboardStuckDocsQuery } from './dashboard/stuck-docs.query';

export const DashboardService = {
  getDashboardStats: DashboardStatsQuery.getDashboardStats,
  getOperationalMetrics: DashboardOperationsQuery.getOperationalMetrics,
  getMonthlyStats: DashboardFinanceQuery.getMonthlyStats,
  getSalesChartData: DashboardFinanceQuery.getSalesChartData,
  getStaleDocuments: DashboardStuckDocsQuery.getStaleDocuments,
};
