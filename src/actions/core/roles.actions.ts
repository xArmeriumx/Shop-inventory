'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/domain';
export type { RoleInput } from '@/services';
import { IamService, type RoleInput, ServiceError } from '@/services';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

export async function getRoles() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES' as any);
      return IamService.getRoles(ctx);
    }, 'iam:getRoles');
  }, { context: { action: 'getRoles' } });
}

export async function getRole(id: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES' as any);
      return IamService.getRole(id, ctx);
    }, 'iam:getRole');
  }, { context: { action: 'getRole', roleId: id } });
}

export async function createRole(input: RoleInput): Promise<ActionResponse<{ id: string }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      const role = await IamService.createRole(input, ctx);
      revalidatePath('/settings/roles');
      return { id: role.id };
    }, 'iam:createRole');
  }, { context: { action: 'createRole' } });
}

export async function updateRole(id: string, input: RoleInput): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      await IamService.updateRole(id, input, ctx);
      revalidatePath('/settings/roles');
      return null;
    }, 'iam:updateRole');
  }, { context: { action: 'updateRole', roleId: id } });
}

export async function deleteRole(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      await IamService.deleteRole(id, ctx);
      revalidatePath('/settings/roles');
      return null;
    }, 'iam:deleteRole');
  }, { context: { action: 'deleteRole', roleId: id } });
}