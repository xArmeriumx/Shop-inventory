import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import type { Permission, User } from '@prisma/client';

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

export const IamService = {
  // ============================================================================
  // ROLES
  // ============================================================================
  async getRoles(ctx: RequestContext) {
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

  async getRole(id: string, ctx: RequestContext) {
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

  async createRole(input: RoleInput, ctx: RequestContext) {
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const existing = await db.role.findFirst({
      where: { shopId: ctx.shopId, name: input.name },
    });

    if (existing) throw new ServiceError('ชื่อ Role นี้ถูกใช้แล้ว');

    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return db.role.create({
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isDefault: input.isDefault ?? false,
        shopId: ctx.shopId,
      },
    });
  },

  async updateRole(id: string, input: RoleInput, ctx: RequestContext) {
    const existing = await db.role.findFirst({
      where: { id, shopId: ctx.shopId },
    });

    if (!existing) throw new ServiceError('ไม่พบข้อมูล Role');
    if (existing.isSystem) throw new ServiceError('ไม่สามารถแก้ไข Role ระบบได้');

    const duplicate = await db.role.findFirst({
      where: { shopId: ctx.shopId, name: input.name, NOT: { id } },
    });

    if (duplicate) throw new ServiceError('ชื่อ Role นี้ถูกใช้แล้ว');

    if (input.isDefault) {
      await db.role.updateMany({
        where: { shopId: ctx.shopId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return db.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        isDefault: input.isDefault ?? false,
      },
    });
  },

  async deleteRole(id: string, ctx: RequestContext) {
    const role = await db.role.findFirst({
      where: { id, shopId: ctx.shopId },
      include: { _count: { select: { members: true } } },
    });

    if (!role) throw new ServiceError('ไม่พบข้อมูล Role');
    if (role.isSystem) throw new ServiceError('ไม่สามารถลบ Role ระบบได้');
    if (role._count.members > 0) {
      throw new ServiceError(`ไม่สามารถลบได้ เนื่องจากมีสมาชิก ${role._count.members} คนใช้ Role นี้อยู่`);
    }

    return db.role.delete({ where: { id } });
  },

  // ============================================================================
  // TEAM
  // ============================================================================
  async getTeamMembers(ctx: RequestContext) {
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

  async updateMemberRole(memberId: string, roleId: string, ctx: RequestContext) {
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const member = await db.shopMember.findFirst({
      where: { id: memberId, shopId: ctx.shopId },
    });

    if (!member) throw new ServiceError('ไม่พบข้อมูลสมาชิก');
    if (member.isOwner) throw new ServiceError('ไม่สามารถเปลี่ยน Role ของเจ้าของร้านได้');
    if (member.userId === ctx.userId) throw new ServiceError('ไม่สามารถแก้ไข Role ของตัวเองได้');

    const role = await db.role.findFirst({
      where: { id: roleId, shopId: ctx.shopId },
    });

    if (!role) throw new ServiceError('ไม่พบข้อมูล Role');

    return db.shopMember.update({
      where: { id: memberId },
      data: { 
        roleId,
        permissionVersion: { increment: 1 },
      },
    });
  },

  async removeMember(memberId: string, ctx: RequestContext) {
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const member = await db.shopMember.findFirst({
      where: { id: memberId, shopId: ctx.shopId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!member) throw new ServiceError('ไม่พบข้อมูลสมาชิก');
    if (member.isOwner) throw new ServiceError('ไม่สามารถลบเจ้าของร้านได้');
    if (member.userId === ctx.userId) throw new ServiceError('ไม่สามารถลบตัวเองได้');

    await db.shopMember.delete({ where: { id: memberId } });

    return member;
  },

  async inviteMember(input: InviteMemberInput, ctx: RequestContext) {
    if (!ctx.shopId) throw new ServiceError('ไม่พบข้อมูลร้านค้า');

    const user = await db.user.findUnique({
      where: { email: input.email },
    });

    if (!user) throw new ServiceError('ไม่พบผู้ใช้งาน กรุณาให้ผู้ใช้ลงทะเบียนก่อน');

    const existingMember = await db.shopMember.findFirst({
      where: { userId: user.id, shopId: ctx.shopId },
    });

    if (existingMember) throw new ServiceError('ผู้ใช้นี้เป็นสมาชิกของร้านอยู่แล้ว');

    const role = await db.role.findFirst({
      where: { id: input.roleId, shopId: ctx.shopId },
    });

    if (!role) throw new ServiceError('ไม่พบข้อมูล Role');

    await db.shopMember.create({
      data: {
        userId: user.id,
        shopId: ctx.shopId,
        roleId: input.roleId,
        isOwner: false,
      },
    });

    return user;
  },

  async updateUserActivity(userId: string) {
    try {
      await db.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    } catch (error) {
      console.error('[IamService] Failed to update user activity:', error);
    }
  },

  async getPermissionVersion(userId: string) {
    const membership = await db.shopMember.findFirst({
      where: { userId },
      select: { permissionVersion: true },
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
  }
};
