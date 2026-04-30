import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';
import { AuditService } from '@/services/core/system/audit.service';
import { IAM_AUDIT_POLICIES } from '@/policies/core/iam.policy';
import { InviteMemberInput } from '../types';

export const IamTeamMutation = {
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
};
