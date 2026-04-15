'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requirePermission, requireShop } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/domain';
export type { InviteMemberInput } from '@/services';
import { IamService, type InviteMemberInput, ServiceError } from '@/services';

export async function getTeamMembers() {
  const ctx = await requirePermission('TEAM_VIEW');
  return IamService.getTeamMembers(ctx);
}

export async function getShopTeamInfo() {
  const ctx = await requireShop();
  return IamService.getShopTeamInfo(ctx);
}

export async function updateMemberRole(memberId: string, roleId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  try {
    await IamService.updateMemberRole(memberId, roleId, ctx);
    revalidatePath('/settings/team');
    return { success: true, message: 'อัปเดต Role สมาชิกสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Update member role error', typedError, { path: 'updateMemberRole', userId: ctx.userId, memberId });
    return { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดต Role' };
  }
}

export async function removeMember(memberId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_REMOVE');

  try {
    const member = await IamService.removeMember(memberId, ctx);
    revalidatePath('/settings/team');
    return { 
      success: true, 
      message: `ลบ ${member.user.name || member.user.email} ออกจากทีมสำเร็จ` 
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Remove member error', typedError, { path: 'removeMember', userId: ctx.userId, memberId });
    return { success: false, message: 'เกิดข้อผิดพลาดในการลบสมาชิก' };
  }
}

export async function inviteMember(input: InviteMemberInput): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_INVITE', { rateLimitPolicy: 'invite' });

  try {
    const user = await IamService.inviteMember(input, ctx);
    revalidatePath('/settings/team');
    return { success: true, message: `เพิ่ม ${user.name || user.email} เข้าทีมสำเร็จ` };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Invite member error', typedError, { path: 'inviteMember', userId: ctx.userId });
    return { success: false, message: 'เกิดข้อผิดพลาดในการเพิ่มสมาชิก' };
  }
}
