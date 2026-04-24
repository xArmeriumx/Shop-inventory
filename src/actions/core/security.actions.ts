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

// ============================================================================
// SELF REVOKE — ผู้ใช้ออกจากระบบทุกอุปกรณ์
// ============================================================================

/**
 * Revoke all sessions for the current user, then sign out immediately.
 */
export async function revokeAllMySessions(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requireAuth();
    // 1. Centralized session revocation via service
    await IamService.revokeSessions(ctx.userId, ctx as any);
    // 2. Sign out current session immediately
    await signOut({ redirect: false });
    return null;
  }, { context: { action: 'revokeAllMySessions' } });
}

// ============================================================================
// ADMIN REVOKE MEMBER — Admin เตะ session ของ member คนอื่น
// ============================================================================

/**
 * Admin revokes all sessions for a target team member.
 */
export async function revokeUserSessionsByAdmin(targetUserId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_ROLES');

    if (targetUserId === ctx.userId) {
      throw new ServiceError('ใช้ "ออกจากระบบทุกอุปกรณ์" สำหรับตัวเองแทน');
    }

    // 1. Centralized session revocation via service
    await IamService.revokeSessions(targetUserId, ctx);
    return null;
  }, { context: { action: 'revokeUserSessionsByAdmin', targetUserId } });
}
