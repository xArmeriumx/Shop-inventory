'use server';

import { requireAuth } from '@/lib/auth-guard';
import { AuditService, type AuditQueryOptions, type AuditStatus } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { ServiceError } from '@/types/domain';

import { handleAction, type ActionResponse } from '@/lib/action-handler';

/**
 * Fetch paginated audit logs for the current shop.
 * Requires SETTINGS_ROLES or higher permission for basic audit trail visibility.
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
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;

    Security.requireAnyPermission(ctx, ['SETTINGS_ROLES' as any, 'SETTINGS_SHOP' as any]);

    return await AuditService.getActivityLog(ctx.shopId, options);
  }, { context: { action: 'getAuditLogs', options } });
}

/**
 * Fetch security dashboard metrics for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function getSecurityMetrics(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;

    Security.requirePermission(ctx, 'SETTINGS_SHOP' as any);

    return await AuditService.getSecurityDashboardMetrics(ctx.shopId);
  }, { context: { action: 'getSecurityMetrics' } });
}

/**
 * Export audit logs for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function exportAuditLogsAction(startDate: string, endDate: string, format: 'CSV' | 'JSON' = 'CSV'): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อทำการ Export');
    }
    const ctx = sessionCtx as any;

    Security.requirePermission(ctx, 'SETTINGS_SHOP' as any);

    return await ExportService.exportAuditLogsData(startDate, endDate, ctx, format);
  }, { context: { action: 'exportAuditLogsAction', startDate, endDate, format } });
}
