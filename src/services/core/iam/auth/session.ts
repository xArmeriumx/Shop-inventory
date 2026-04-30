import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { IAM_AUDIT_POLICIES } from '@/policies/core/iam.policy';
import { PermissionData } from '../types';

export const IamSessionService = {
  async revokeSessions(targetUserId: string, ctx: RequestContext): Promise<void> {
    const isSelf = targetUserId === ctx.userId;

    // Authorization check
    if (!isSelf) {
      Security.requirePermission(ctx, 'SETTINGS_ROLES');
      const targetMember = await db.shopMember.findFirst({
        where: { userId: targetUserId, shopId: ctx.shopId },
      });
      if (!targetMember) throw new ServiceError('ไม่พบสมาชิกในทีม');
      if (targetMember.isOwner && !ctx.isOwner) {
        throw new ServiceError('ไม่สามารถเพิกถอน session ของเจ้าของร้านได้');
      }
    }

    const policy = isSelf
      ? IAM_AUDIT_POLICIES.SESSION_REVOKE_ALL(ctx.userId)
      : IAM_AUDIT_POLICIES.SESSION_REVOKE_BY_ADMIN(targetUserId, ctx.userId);

    await AuditService.runWithAudit(
      ctx,
      policy,
      async () => {
        // 1. Increment sessionVersion in DB → invalidates all current JWTs
        await db.user.update({
          where: { id: targetUserId },
          data: { sessionVersion: { increment: 1 } },
        });

        // 2. Bump permissionVersion for the shop member to ensure RBAC refresh
        if (ctx.shopId) {
          await db.shopMember.updateMany({
            where: { userId: targetUserId, shopId: ctx.shopId },
            data: { permissionVersion: { increment: 1 } },
          });
        }
      }
    );
  },

  async getPermissionVersion(userId: string, shopId?: string) {
    // Priority 1: Unique lookup if shopId is provided (O(1))
    if (shopId) {
      const membership = await db.shopMember.findFirst({
        where: { userId, shopId },
        select: { permissionVersion: true },
      });
      return membership ? { version: membership.permissionVersion } : null;
    }

    // Priority 2: Fallback to first membership (Index Scan)
    const membership = await db.shopMember.findFirst({
      where: { userId },
      select: { permissionVersion: true },
      orderBy: { joinedAt: 'asc' },
    });
    return membership ? { version: membership.permissionVersion } : null;
  },

  async getMyPermissions(userId: string): Promise<PermissionData | null> {
    const membership = await db.shopMember.findFirst({
      where: { userId },
      select: {
        shopId: true,
        roleId: true,
        isOwner: true,
        permissionVersion: true,
        role: { select: { permissions: true } },
      },
    });

    if (!membership) return null;

    return {
      shopId: membership.shopId,
      roleId: membership.roleId ?? undefined,
      permissions: membership.role?.permissions ?? [],
      isOwner: membership.isOwner,
      version: membership.permissionVersion,
    };
  },
};
