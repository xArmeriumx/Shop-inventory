'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/domain';
export type { RoleInput } from '@/services';
import { IamService, type RoleInput, ServiceError } from '@/services';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

import { roleFormSchema } from '@/schemas/core/role-form.schema';

export async function getRoles() {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      return IamService.getRoles(ctx);
    }, 'iam:getRoles');
  }, { context: { action: 'getRoles' } });
}

export async function getRole(id: string) {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      return IamService.getRole(id, ctx);
    }, 'iam:getRole');
  }, { context: { action: 'getRole', roleId: id } });
}

export async function createRole(input: any): Promise<ActionResponse<{ id: string }>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES');
    const validated = roleFormSchema.parse(input);
    
    // Convert permissions to Enum compatible array
    const result = await IamService.createRole(validated as any, ctx);
    
    revalidatePath('/settings/roles');
    return { id: result.id };
  }, { context: { action: 'createRole' } });
}

export async function updateRole(id: string, input: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES');
    const validated = roleFormSchema.parse(input);
    
    await IamService.updateRole(id, validated as any, ctx);
    
    revalidatePath('/settings/roles');
    return null;
  }, { context: { action: 'updateRole', roleId: id } });
}

export async function deleteRole(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES');
    await IamService.deleteRole(id, ctx);
    
    revalidatePath('/settings/roles');
    return null;
  }, { context: { action: 'deleteRole', roleId: id } });
}