import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';

export const SettingsService = {
  // ============================================================================
  // SHOP SETTINGS
  // ============================================================================
  async getShop(ctx: RequestContext) {
    if (ctx.shopId) {
      return db.shop.findUnique({
        where: { id: ctx.shopId },
      });
    }

    return db.shop.findUnique({
      where: { userId: ctx.userId },
    });
  },

  async updateShop(data: any, ctx: RequestContext) {
    return db.shop.upsert({
      where: { userId: ctx.userId },
      update: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        logo: data.logo,
        taxId: data.taxId,
        promptPayId: data.promptPayId,
      },
      create: {
        userId: ctx.userId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        logo: data.logo,
        taxId: data.taxId,
        promptPayId: data.promptPayId,
      },
    });
  },

  // ============================================================================
  // USER PROFILE SETTINGS
  // ============================================================================
  async getUserProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) throw new ServiceError('User not found');

    return user;
  },

  async updateUserProfile(userId: string, data: { name: string }) {
    return db.user.update({
      where: { id: userId },
      data: { name: data.name },
    });
  }
};
