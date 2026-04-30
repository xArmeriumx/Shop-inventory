import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';

export const IamRoleQuery = {
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
};
