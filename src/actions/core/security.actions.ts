'use server';

import { signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { IamService } from '@/services/core/iam/iam.service';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { ServiceError } from '@/types/common';

// ============================================================================
// SELF REVOKE — ผู้ใช้ออกจากระบบทุกอุปกรณ์
// ============================================================================

import { changePasswordSchema } from '@/schemas/core/security.schema';

export async function changePassword(input: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requireAuth();
    const validated = changePasswordSchema.parse(input);

    await IamService.updatePassword(ctx as any, validated);

    // After password change, we usually force logout but here we just return success
    // The service already incremented sessionVersion which will trigger re-auth
    return null;
  }, { context: { action: 'changePassword' } });
}

/**
 * Revoke all sessions for the current user, then sign out immediately.
 */
export async function revokeAllMySessions(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requireAuth();
    await IamService.revokeSessions(ctx.userId, ctx as any);
    return null;
  }, { context: { action: 'revokeAllMySessions' } });
}

/**
 * Admin revokes all sessions for a target team member.
 */
export async function revokeUserSessionsByAdmin(targetUserId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES');

    if (targetUserId === ctx.userId) {
      throw new ServiceError('ใช้ "ออกจากระบบทุกอุปกรณ์" สำหรับตัวเองแทน');
    }

    await IamService.revokeSessions(targetUserId, ctx);
    return null;
  }, { context: { action: 'revokeUserSessionsByAdmin', targetUserId } });
}
