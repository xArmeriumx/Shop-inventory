'use server';

import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { ReportService } from '@/services';

/**
 * Fetch categorized product velocity intelligence
 */
export async function getInventoryIntelligence(windowDays: number = 30) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  try {
    return await ReportService.getInventoryIntelligence(windowDays, ctx);
  } catch (error: any) {
    await logger.error('Failed to fetch inventory intelligence', error, { windowDays });
    throw new Error('ไม่สามารถประมวลผลข้อมูลอัจฉริยะได้');
  }
}

/**
 * Fetch procurement lead distance and supplier aging
 */
export async function getProcurementAging(limit: number = 20) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  try {
    return await ReportService.getProcurementAging(limit, ctx);
  } catch (error: any) {
    await logger.error('Failed to fetch procurement aging', error, { limit });
    throw new Error('ไม่สามารถดึงข้อมูลระยะเวลาสั่งซื้อได้');
  }
}

/**
 * Fetch sales activity heatmap (Category vs Time)
 */
export async function getSalesHeatmap(windowDays: number = 30) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  try {
    return await ReportService.getSalesHeatmap(windowDays, ctx);
  } catch (error: any) {
    await logger.error('Failed to fetch sales heatmap', error, { windowDays });
    throw new Error('ไม่สามารถประมวลผล Heatmap การขายได้');
  }
}

/**
 * Fetch smart reorder suggestions based on velocity and lead times
 */
export async function getReorderSuggestions() {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  try {
    return await ReportService.getReorderSuggestions(ctx);
  } catch (error: any) {
    await logger.error('Failed to fetch reorder suggestions', error);
    throw new Error('ไม่สามารถประมวลผลข้อแนะนำการสั่งซื้อได้');
  }
}
