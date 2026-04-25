'use server';

import { requireAuth } from '@/lib/auth-guard';
import { AuditService } from '@/services/core/system/audit.service';
import { db } from '@/lib/db';
import { Security } from '@/services/core/iam/security.service';
import { ServiceError } from '@/types/domain';

import { handleAction, type ActionResponse } from '@/lib/action-handler';

export async function getSecurityDashboardData(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const sessionCtx = await requireAuth();
    if (!sessionCtx.shopId) {
      throw new ServiceError('กรุณาเลือกร้านค้าเพื่อดูข้อมูล');
    }
    const ctx = sessionCtx as any;

    // Only Owners or Admins (with SETTINGS_ROLES or SETTINGS_SHOP) should see full security dashboard
    Security.requireAnyPermission(ctx, ['SETTINGS_ROLES', 'SETTINGS_SHOP']);

    return await AuditService.getSecurityDashboardMetrics(ctx.shopId);
  }, { context: { action: 'getSecurityDashboardData' } });
}
