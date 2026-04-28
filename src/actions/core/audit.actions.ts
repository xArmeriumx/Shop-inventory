'use server';

import { requirePermission } from '@/lib/auth-guard';
import { AuditService, type AuditQueryOptions, type AuditStatus } from '@/services/core/system/audit.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { ServiceError } from '@/types/domain';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

/**
 * Fetch paginated audit logs for the current shop.
 * Requires AUDIT_VIEW permission (owner bypass included via requirePermission).
 */
export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  action?: string;
  status?: AuditStatus;
  targetType?: string;
  targetId?: string;
  actorUserId?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    // Use `requirePermission` which handles: auth, shopId check, RBAC (owner bypass)
    const ctx = await requirePermission('AUDIT_VIEW');
    return await AuditService.getActivityLog(ctx.shopId, options);
  }, { context: { action: 'getAuditLogs', options } });
}

/**
 * Fetch security dashboard metrics for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function getSecurityMetrics(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    return await AuditService.getSecurityDashboardMetrics(ctx.shopId);
  }, { context: { action: 'getSecurityMetrics' } });
}

/**
 * Export audit logs for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function exportAuditLogsAction(startDate: string, endDate: string, format: 'CSV' | 'JSON' = 'CSV'): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    return await ExportService.exportAuditLogsData(startDate, endDate, ctx, format);
  }, { context: { action: 'exportAuditLogsAction', startDate, endDate, format } });
}
