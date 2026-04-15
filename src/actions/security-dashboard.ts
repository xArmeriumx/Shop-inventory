'use server';

import { requireAuth } from '@/lib/auth-guard';
import { AuditService } from '@/services/audit.service';
import { Security } from '@/services/security';
import { ServiceError } from '@/types/domain';

export type SecurityDashboardResult = {
  success: boolean;
  message?: string;
  data?: any;
};

export async function getSecurityDashboardData(): Promise<SecurityDashboardResult> {
  try {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;
    
    // Only Owners or Admins (with TEAM_EDIT or SETTINGS_SHOP) should see full security dashboard
    Security.requireAnyPermission(ctx, ['TEAM_EDIT', 'SETTINGS_SHOP']);

    const metrics = await AuditService.getSecurityDashboardMetrics(ctx.shopId);
    
    return {
      success: true,
      data: metrics,
    };
  } catch (error: any) {
    return { 
        success: false, 
        message: error instanceof ServiceError ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูล Security Dashboard' 
    };
  }
}
