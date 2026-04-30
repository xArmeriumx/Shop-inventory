import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { Security } from '@/services/core/iam/security.service';

export const IamTeamQuery = {
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
};
