import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import type { Permission, User } from '@prisma/client';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { IIamService } from '@/types/service-contracts';
import { IAM_AUDIT_POLICIES } from '@/policies/core/iam.policy';

export interface PermissionData {
  shopId: string;
  roleId?: string;
  permissions: Permission[];
  isOwner: boolean;
  version: number;
}


export interface RoleInput {
  name: string;
  description?: string;
  permissions: Permission[];
  isDefault?: boolean;
}

export interface InviteMemberInput {
  email: string;
  roleId: string;
}


export const IamService: IIamService = {
  // ============================================================================
  // --- QUERIES ---
  // ============================================================================
  async getRoles(ctx: RequestContext) {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) return [];

    return db.role.findMany({
      where: { shopId: ctx.shopId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: [
        { isSystem: 'desc' },
        { name: 'asc' },
      ],
    });
  },

  async getRole(id: string, ctx: RequestContext): Promise<any> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    const role = await db.role.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    });

    if (!role) throw new ServiceError('ไม่พบข้อมูล Role');

    return role;
  },

  // ============================================================================
  // --- COMMANDS ---
  // ============================================================================

  async createRole(input: RoleInput, ctx: RequestContext): Promise<{ id: string }> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    return AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.CREATE_ROLE(input.name),
        afterSnapshot: () => db.role.findFirst({
          where: { shopId: ctx.shopId, name: input.name },
        }),
      },
      async () => {
        const existing = await db.role.findFirst({
          where: { shopId: ctx.shopId!, name: input.name },
        });

        if (existing) throw new ServiceError('ชื่อ Role นี้ถูกใช้แล้ว');

        if (input.isDefault) {
          await db.role.updateMany({
            where: { shopId: ctx.shopId!, isDefault: true },
            data: { isDefault: false },
          });
        }

        return db.role.create({
          data: {
            name: input.name,
            description: input.description,
            permissions: input.permissions,
            isDefault: input.isDefault ?? false,
            shopId: ctx.shopId!,
          },
        });
      }
    );
  },

  async updateRole(id: string, input: RoleInput, ctx: RequestContext): Promise<void> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');

    const existing = await db.role.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูล Role');
    if (existing.isSystem) throw new ServiceError('ไม่สามารถแก้ไข Role ระบบได้');

    await AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.UPDATE_ROLE(id, input.name, ctx.shopId),
        beforeSnapshot: () => existing,
        afterSnapshot: () => db.role.findFirst({ where: { id } }),
      },
      async () => {
        const duplicate = await db.role.findFirst({
          where: { shopId: ctx.shopId!, name: input.name, NOT: { id } },
        });

        if (duplicate) throw new ServiceError('ชื่อ Role นี้ถูกใช้แล้ว');

        if (input.isDefault) {
          await db.role.updateMany({
            where: { shopId: ctx.shopId!, isDefault: true, NOT: { id } },
            data: { isDefault: false },
          });
        }

        await db.role.update({
          where: { id },
          data: {
            name: input.name,
            description: input.description,
            permissions: input.permissions,
            isDefault: input.isDefault ?? false,
          },
        });

        // Invalidate all members having this role to trigger session refresh
        await db.shopMember.updateMany({
          where: { roleId: id },
          data: { permissionVersion: { increment: 1 } },
        });
      }
    );
  },

  async deleteRole(id: string, ctx: RequestContext): Promise<void> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');

    const role = await db.role.findFirst({
      where: { id, shopId: ctx.shopId },
      include: { _count: { select: { members: true } } },
    });

    if (!role) throw new ServiceError('ไม่พบข้อมูล Role');
    if (role.isSystem) throw new ServiceError('ไม่สามารถลบ Role ระบบได้');
    if (role._count.members > 0) {
      throw new ServiceError(`ไม่สามารถลบได้ เนื่องจากมีสมาชิก ${role._count.members} คนใช้ Role นี้อยู่`);
    }

    await AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.DELETE_ROLE(id, ctx.shopId),
        beforeSnapshot: () => role,
      },
      async () => {
        await db.role.delete({ where: { id } });
      }
    );
  },

  // ============================================================================
  // TEAM
  // ============================================================================
  async getTeamMembers(ctx: RequestContext) {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) return [];

    return db.shopMember.findMany({
      where: { shopId: ctx.shopId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: [
        { isOwner: 'desc' },
        { joinedAt: 'asc' },
      ],
    });
  },

  async getShopTeamInfo(ctx: RequestContext) {
    if (!ctx.shopId) return null;

    return db.shop.findUnique({
      where: { id: ctx.shopId },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true, roles: true } },
      },
    });
  },

  async updateMemberRole(memberId: string, roleId: string, ctx: RequestContext): Promise<void> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const member = await db.shopMember.findFirst({
      where: { id: memberId, shopId: ctx.shopId },
    });

    if (!member) throw new ServiceError('ไม่พบข้อมูลสมาชิก');
    if (member.isOwner) throw new ServiceError('ไม่สามารถเปลี่ยน Role ของเจ้าของร้านได้');
    if (member.userId === ctx.userId) throw new ServiceError('ไม่สามารถแก้ไข Role ของตัวเองได้');

    const newRole = await db.role.findFirst({
      where: { id: roleId, shopId: ctx.shopId },
    });

    if (!newRole) throw new ServiceError('ไม่พบข้อมูล Role');

    await AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.UPDATE_MEMBER_ROLE(memberId, ctx.shopId),
        beforeSnapshot: () => member,
        afterSnapshot: () => db.shopMember.findFirst({ where: { id: memberId } }),
      },
      async () => {
        await db.shopMember.update({
          where: { id: memberId },
          data: { roleId, permissionVersion: { increment: 1 } },
        });
      }
    );
  },

  async removeMember(memberId: string, ctx: RequestContext): Promise<void> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const member = await db.shopMember.findFirst({
      where: { id: memberId, shopId: ctx.shopId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!member) throw new ServiceError('ไม่พบข้อมูลสมาชิก');
    if (member.isOwner) throw new ServiceError('ไม่สามารถลบเจ้าของร้านได้');
    if (member.userId === ctx.userId) throw new ServiceError('ไม่สามารถลบตัวเองได้');

    await AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.REMOVE_MEMBER(memberId, ctx.shopId),
        beforeSnapshot: () => member,
      },
      async () => {
        await db.shopMember.delete({ where: { id: memberId } });
      }
    );
  },

  async inviteMember(input: InviteMemberInput, ctx: RequestContext): Promise<void> {
    Security.requirePermission(ctx, 'SETTINGS_ROLES');
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    await AuditService.runWithAudit(
      ctx,
      {
        ...IAM_AUDIT_POLICIES.INVITE_MEMBER(ctx.shopId!, input.email),
        afterSnapshot: () => db.shopMember.findFirst({
          where: { shopId: ctx.shopId!, user: { email: input.email } },
        }),
      },
      async () => {
        const user = await db.user.findUnique({
          where: { email: input.email },
        });

        if (!user) throw new ServiceError('ไม่พบผู้ใช้งาน กรุณาให้ผู้ใช้ลงทะเบียนก่อน');

        const existingMember = await db.shopMember.findFirst({
          where: { userId: user.id, shopId: ctx.shopId! },
        });

        if (existingMember) throw new ServiceError('ผู้ใช้นี้เป็นสมาชิกของร้านอยู่แล้ว');

        const role = await db.role.findFirst({
          where: { id: input.roleId, shopId: ctx.shopId! },
        });

        if (!role) throw new ServiceError('ไม่พบข้อมูล Role');

        await db.shopMember.create({
          data: {
            userId: user.id,
            shopId: ctx.shopId!,
            roleId: input.roleId,
            isOwner: false,
          },
        });
      }
    );
  },

  async updateUserActivity(userId: string): Promise<void> {
    try {
      await db.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      console.error('[IamService] Failed to update user activity:', error);
    }
  },

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

  async getProfile(userId: string) {
    const membership = await db.shopMember.findFirst({
      where: { userId },
      select: {
        departmentCode: true,
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!membership) return null;

    return {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      departmentCode: membership.departmentCode
    };
  },

  async registerUser(data: { name: string; email: string; passwordHash: string }): Promise<User> {
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    }

    return db.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: data.passwordHash,
      },
    });
  },

  async updatePassword(ctx: RequestContext, input: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: ctx.userId },
    });

    if (!user || !user.password) throw new ServiceError('ไม่พบข้อมูลผู้ใช้งาน');

    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isValid) throw new ServiceError('รหัสผ่านปัจจุบันไม่ถูกต้อง');

    const hashedPassword = await bcrypt.hash(input.newPassword, 12);

    await AuditService.runWithAudit(
      ctx,
      {
        action: 'IAM_PASSWORD_CHANGE',
        targetType: 'User',
        targetId: ctx.userId,
        note: 'ผู้ใช้เปลี่ยนรหัสผ่านด้วยตนเอง',
      },
      async () => {
        await db.user.update({
          where: { id: ctx.userId },
          data: { 
            password: hashedPassword,
            sessionVersion: { increment: 1 }, // Logout other devices for security
          },
        });
      }
    );
  },
};
