'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/domain';
export type { RoleInput } from '@/services';
import { IamService, type RoleInput, ServiceError } from '@/services';

export async function getRoles() {
  const ctx = await requirePermission('TEAM_VIEW');
  return IamService.getRoles(ctx);
}

export async function getRole(id: string) {
  const ctx = await requirePermission('TEAM_VIEW');
  try {
    return await IamService.getRole(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

export async function createRole(input: RoleInput): Promise<ActionResponse<{ id: string }>> {
  const ctx = await requirePermission('TEAM_EDIT');

  try {
    const role = await IamService.createRole(input, ctx);
    revalidatePath('/settings/roles');
    return { success: true, data: { id: role.id }, message: 'สร้าง Role สำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Create role error', typedError, { path: 'createRole', userId: ctx.userId });
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้าง Role' };
  }
}

export async function updateRole(id: string, input: RoleInput): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  try {
    await IamService.updateRole(id, input, ctx);
    revalidatePath('/settings/roles');
    return { success: true, message: 'อัปเดต Role สำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Update role error', typedError, { path: 'updateRole', userId: ctx.userId, roleId: id });
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต Role' };
  }
}

export async function deleteRole(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  try {
    await IamService.deleteRole(id, ctx);
    revalidatePath('/settings/roles');
    return { success: true, message: 'ลบ Role สำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Delete role error', typedError, { path: 'deleteRole', userId: ctx.userId, roleId: id });
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบ Role' };
  }
}