import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { IAM_AUDIT_POLICIES } from '@/policies/core/iam.policy';
import { RoleInput } from '../types';

export const IamRoleMutation = {
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
};
