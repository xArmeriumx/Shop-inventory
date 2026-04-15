'use server';

import { requireAuth } from '@/lib/auth-guard';
import { AuditService, type AuditQueryOptions, type AuditStatus } from '@/services/audit.service';
import { Security } from '@/services/security';
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
 * Requires TEAM_VIEW or higher permission for basic audit trail visibility.
 * (For a stricter system, you might require a dedicated AUDIT_VIEW permission, 
 * but TEAM_VIEW / SETTINGS_SHOP usually covers Admin operations in this ERP).
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
    
    // Only Owners or Admins (with TEAM_EDIT or SETTINGS_SHOP) should see full audit logs
    Security.requireAnyPermission(ctx, ['TEAM_EDIT', 'SETTINGS_SHOP']);

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
