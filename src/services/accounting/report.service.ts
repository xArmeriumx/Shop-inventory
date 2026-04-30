/**
 * report.service.ts — Public Facade
 * ============================================================================
 * Single import point สำหรับ Action layer — ไม่เปลี่ยน public API
 * Logic ทั้งหมดอยู่ใน reports/ sub-folder แยกตาม responsibility
 *
 * Structure:
 *   reports/helpers.ts         → shared types, date utils, pctChange
 *   reports/sales.ts     → getReportData, getComparisonReport, getSalesChannelReport, getSalesHeatmap
 *   reports/profit.ts    → getProfitLossReport, getProfitByProduct, getTopProducts, getSalesByCategory
 *   reports/inventory.ts → getStockValueReport, getInventoryTurnover, getInventoryIntelligence, getReorderSuggestions
 *   reports/purchase.ts  → getPurchaseReport, getProcurementAging
 *   reports/customer.ts  → getCustomerRankingReport, getExpenseByCategoryReport
 */

// ── Types & Helpers ──────────────────────────────────────────────────────────
export type { ReportData, InventoryIntelligence } from './reports/helpers';
export { ANALYTICS_THRESHOLDS, getReportLayoutMetadata } from './reports/helpers';

// ── Sales Reports ────────────────────────────────────────────────────────────
export { getReportData, getComparisonReport, getSalesChannelReport, getSalesHeatmap } from './reports/sales';

// ── Profit Reports ───────────────────────────────────────────────────────────
export { getProfitLossReport, getProfitByProduct, getTopProducts, getSalesByCategory } from './reports/profit';

// ── Inventory Reports ────────────────────────────────────────────────────────
export { getStockValueReport, getInventoryTurnover, getInventoryIntelligence, getReorderSuggestions } from './reports/inventory';

// ── Purchase Reports ─────────────────────────────────────────────────────────
export { getPurchaseReport, getProcurementAging } from './reports/purchase';

// ── Customer & Expense Reports ───────────────────────────────────────────────
export { getCustomerRankingReport, getExpenseByCategoryReport } from './reports/customer';

// ── Backward-compatible ReportService object ─────────────────────────────────
// เพื่อรองรับโค้ดที่ import { ReportService } from '...'
import { getReportData } from './reports/sales';
import { getComparisonReport, getSalesChannelReport, getSalesHeatmap } from './reports/sales';
import { getProfitLossReport, getProfitByProduct, getTopProducts, getSalesByCategory } from './reports/profit';
import { getStockValueReport, getInventoryTurnover, getInventoryIntelligence, getReorderSuggestions } from './reports/inventory';
import { getPurchaseReport, getProcurementAging } from './reports/purchase';
import { getCustomerRankingReport, getExpenseByCategoryReport } from './reports/customer';
import { getReportLayoutMetadata } from './reports/helpers';

export const ReportService = {
  getReportData,
  getPurchaseReport,
  getReportLayoutMetadata,
  getTopProducts,
  getProfitByProduct,
  getComparisonReport,
  getStockValueReport,
  getInventoryTurnover,
  getSalesByCategory,
  getProfitLossReport,
  getExpenseByCategoryReport,
  getSalesChannelReport,
  getCustomerRankingReport,
  getInventoryIntelligence,
  getProcurementAging,
  getSalesHeatmap,
  getReorderSuggestions,
};
