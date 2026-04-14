'use server';

import { requirePermission } from '@/lib/auth-guard';
export type { SystemMetrics } from '@/services';
import { SystemService, type SystemMetrics } from '@/services';

export async function getSystemMetrics(): Promise<SystemMetrics> {
  // Security check: Only Shop Owners/Admins (who have shop settings permissions) can view system stats
  await requirePermission('SETTINGS_SHOP');
  return SystemService.getMetrics();
}

export async function generateTestLog() {
  throw new Error('Test logging feature is globally disabled.');
}
