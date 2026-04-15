'use server';

import { signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { AuditService } from '@/services/audit.service';
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
    // 1. Increment sessionVersion in DB → invalidates all current JWTs
    await db.user.update({
      where: { id: ctx.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    // 2. Audit log before signing out
    await AuditService.log(ctx as any, {
      action: 'SESSION_REVOKE_ALL',
      targetType: 'User',
      targetId: ctx.userId,
      note: 'ผู้ใช้ออกจากระบบทุกอุปกรณ์',
    });

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
 * Requires: TEAM_EDIT permission (same level as role change).
 */
export async function revokeUserSessionsByAdmin(targetUserId: string): Promise<ActionResponse> {
  const ctx = await requirePermission('TEAM_EDIT');

  if (targetUserId === ctx.userId) {
    return { success: false, message: 'ใช้ "ออกจากระบบทุกอุปกรณ์" สำหรับตัวเองแทน' };
  }

  try {
    // 1. Verify target is a member of the same shop
    const targetMember = await db.shopMember.findFirst({
      where: { userId: targetUserId, shopId: ctx.shopId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!targetMember) {
      throw new ServiceError('ไม่พบสมาชิกในทีม');
    }

    if (targetMember.isOwner && !ctx.isOwner) {
      throw new ServiceError('ไม่สามารถ revoke session ของเจ้าของร้านได้');
    }

    // 2. Increment sessionVersion → forces re-login on next sensitive operation
    await db.user.update({
      where: { id: targetUserId },
      data: { sessionVersion: { increment: 1 } },
    });

    // 3. Bump permissionVersion too → ensures RBAC refresh
    await db.shopMember.update({
      where: { id: targetMember.id },
      data: { permissionVersion: { increment: 1 } },
    });

    // 4. Audit log (Admin's perspective)
    await AuditService.log(ctx, {
      action: 'SESSION_REVOKE_BY_ADMIN',
      targetType: 'User',
      targetId: targetUserId,
      afterSnapshot: {
        targetEmail: targetMember.user?.email,
        targetName: targetMember.user?.name,
      },
      note: `Admin เพิกถอน session ของ ${targetMember.user?.name ?? targetUserId}`,
    });

    return {
      success: true,
      message: `เพิกถอน session ของ ${targetMember.user?.name ?? targetUserId} เรียบร้อยแล้ว`,
    };
  } catch (error: any) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}
