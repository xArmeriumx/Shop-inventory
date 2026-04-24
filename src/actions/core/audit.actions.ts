'use server';

import { requireAuth } from '@/lib/auth-guard';
import { AuditService, type AuditQueryOptions, type AuditStatus } from '@/services/core/system/audit.service';
import { Security } from '@/services/core/iam/security.service';
import { ExportService } from '@/services/core/intelligence/export.service';
import { ServiceError } from '@/types/domain';

export type GetAuditLogsResult = {
  data: any[];
  total: number;
  page: number;
  totalPages: number;
  success: boolean;
  message?: string;
};

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
} = {}): Promise<GetAuditLogsResult> {
  try {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;

    Security.requireAnyPermission(ctx, ['SETTINGS_ROLES' as any, 'SETTINGS_SHOP' as any]);

    const result = await AuditService.getActivityLog(ctx.shopId, options);

    return {
      ...result,
      success: true,
    };
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return { data: [], total: 0, page: 1, totalPages: 0, success: false, message: error.message };
    }
    return { data: [], total: 0, page: 1, totalPages: 0, success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Audit Log' };
  }
}

/**
 * Fetch security dashboard metrics for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function getSecurityMetrics() {
  try {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;

    Security.requirePermission(ctx, 'SETTINGS_SHOP' as any);

    const metrics = await AuditService.getSecurityDashboardMetrics(ctx.shopId);

    return {
      ...metrics,
      success: true,
    };
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล Security Metrics' };
  }
}

/**
 * Export audit logs for the current shop.
 * Requires SETTINGS_SHOP permission.
 */
export async function exportAuditLogsAction(startDate: string, endDate: string, format: 'CSV' | 'JSON' = 'CSV') {
  try {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อทำการ Export');
    }
    const ctx = sessionCtx as any;

    Security.requirePermission(ctx, 'SETTINGS_SHOP' as any);

    const data = await ExportService.exportAuditLogsData(startDate, endDate, ctx, format);

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'เกิดข้อผิดพลาดในการ Export ข้อมูล' };
  }
}
