/**
 * report.helpers.ts — Shared utilities for all report queries
 * Pure functions only — no DB, no ctx, no side effects
 */
import { money } from '@/lib/money';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportData {
  period: { start: string; end: string };
  summary: {
    totalSales: number;
    totalCost: number;
    totalExpenses: number;
    totalIncomes: number;
    grossProfit: number;
    netProfit: number;
  };
  dailyStats: {
    date: string;
    sales: number;
    cost: number;
    expenses: number;
    incomes: number;
    profit: number;
  }[];
  sales: any[];
  expenses: any[];
  incomes: any[];
}

export interface InventoryIntelligence {
  stars: any[];
  sluggish: any[];
  critical: any[];
  metadata: {
    totalValue: number;
    windowDays: number;
  };
}

export const ANALYTICS_THRESHOLDS = {
  SLUGGISH_DAYS: 30,
  HIGH_STOCK_VALUE: 10,
  STAR_PERCENTILE: 0.1, // Top 10%
};

// ─── Shared Date Helpers ──────────────────────────────────────────────────────

/**
 * Resolve start/end Date objects from optional string inputs.
 * Defaults to current month if not provided.
 */
export function resolveDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): { start: Date; end: Date } {
  const now = new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate
    ? new Date(endDate)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Calculate the previous period of equal duration (for period-over-period comparison).
 */
export function resolvePrevPeriod(start: Date, end: Date): { prevStart: Date; prevEnd: Date } {
  const durationMs = end.getTime() - start.getTime();
  return {
    prevStart: new Date(start.getTime() - durationMs),
    prevEnd: new Date(start.getTime() - 1),
  };
}

/**
 * Percentage change from previous to current value.
 * Returns 100 if previous was 0 and current is positive.
 */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return money.round(((current - previous) / Math.abs(previous)) * 100, 1);
}

/**
 * UC 17: Pagination layout metadata
 * Determines if summary block should be rendered based on page info.
 */
export function getReportLayoutMetadata(currentPage: number, totalPages: number) {
  return {
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    showFooterSummary: currentPage === totalPages,
  };
}
