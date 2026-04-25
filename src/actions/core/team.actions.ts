'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission, requireShop } from '@/lib/auth-guard';
import { IamService, type InviteMemberInput } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

import { inviteMemberSchema } from '@/schemas/core/team.schema';

export async function getTeamMembers(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      return IamService.getTeamMembers(ctx);
    }, 'iam:getTeamMembers');
  }, { context: { action: 'getTeamMembers' } });
}

export async function getShopTeamInfo(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      return IamService.getShopTeamInfo(ctx);
    }, 'iam:getShopTeamInfo');
  }, { context: { action: 'getShopTeamInfo' } });
}

export async function updateMemberRole(memberId: string, roleId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      await IamService.updateMemberRole(memberId, roleId, ctx);
      revalidatePath('/settings/team');
      return null;
    }, 'iam:updateMemberRole');
  }, { context: { action: 'updateMemberRole', memberId, roleId } });
}

export async function removeMember(memberId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_ROLES');
      await IamService.removeMember(memberId, ctx);
      revalidatePath('/settings/team');
      return null;
    }, 'iam:removeMember');
  }, { context: { action: 'removeMember', memberId } });
}

export async function inviteMember(input: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES', { rateLimitPolicy: 'invite' });
    const validated = inviteMemberSchema.parse(input);
    
    await IamService.inviteMember(validated, ctx);
    revalidatePath('/settings/team');
    return null;
  }, { context: { action: 'inviteMember', email: input.email } });
}
