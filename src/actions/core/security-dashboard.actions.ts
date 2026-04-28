'use server';

import { requirePermission } from '@/lib/auth-guard';
import { AuditService } from '@/services/core/system/audit.service';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

/** ดึง Security Dashboard metrics — เฉพาะ Owner/Admin */
export async function getSecurityDashboardData(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    return await AuditService.getSecurityDashboardMetrics(ctx.shopId);
  }, { context: { action: 'getSecurityDashboardData' } });
}
