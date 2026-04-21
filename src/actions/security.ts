'use server';

import { signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { IamService } from '@/services/iam.service';
import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';

// ============================================================================
// SELF REVOKE — ผู้ใช้ออกจากระบบทุกอุปกรณ์
// ============================================================================

/**
 * Revoke all sessions for the current user, then sign out immediately.
 * 
 * Increments `sessionVersion` in DB — any existing JWT with an older version
 * will be rejected on the next sensitive operation.
 * 
 * Self-revoke: always signs out current session too (UX: "all devices" means all).
 */
export async function revokeAllMySessions(): Promise<ActionResponse> {
  const ctx = await requireAuth();

  try {
    // 1. Centralized session revocation via service
    await IamService.revokeSessions(ctx.userId, ctx as any);

    // 3. Sign out current session immediately
    // (self-revoke: "all devices" includes this device)
    await signOut({ redirect: false });

    return { success: true, message: 'ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว' };
  } catch (error: any) {
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}

// ============================================================================
// ADMIN REVOKE MEMBER — Admin เตะ session ของ member คนอื่น
// ============================================================================

/**
 * Admin revokes all sessions for a target team member.
 * 
 * The target user will be forced to re-login on their next request.
 * Admin's own session is NOT affected.
 * 
 * Requires: SETTINGS_ROLES permission (same level as role change).
 */
export async function revokeUserSessionsByAdmin(targetUserId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('SETTINGS_ROLES');

  if (targetUserId === ctx.userId) {
    return { success: false, message: 'ใช้ "ออกจากระบบทุกอุปกรณ์" สำหรับตัวเองแทน' };
  }

  try {
    // 1. Centralized session revocation via service (includes authz checks)
    await IamService.revokeSessions(targetUserId, ctx);

    return {
      success: true,
      message: `เพิกถอน session ของผู้ใช้ ID: ${targetUserId} เรียบร้อยแล้ว`,
    };
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}
