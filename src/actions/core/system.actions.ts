'use server';

import { requirePermission } from '@/lib/auth-guard';
import { SystemService, type SystemMetrics } from '@/services';
export type { SystemMetrics };
import { handleAction } from '@/lib/action-handler';
import { ActionResponse } from '@/types/common';

export async function getSystemMetrics(): Promise<ActionResponse<SystemMetrics>> {
  return handleAction(async () => {
    // Security check: Only Shop Owners/Admins (who have shop settings permissions) can view system stats
    await requirePermission('SETTINGS_SHOP');
    return SystemService.getMetrics();
  });
}

export async function getHardeningHealth(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    await requirePermission('SETTINGS_SHOP');
    return SystemService.getHardeningHealthMetrics();
  });
}

export async function generateTestLog(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    throw new Error('Test logging feature is globally disabled.');
  });
}
