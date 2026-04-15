import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from './security';
import { AuditService } from './audit.service';

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
    Security.requirePermission(ctx, 'SETTINGS_SHOP');

    // Capture before snapshot
    const before = ctx.shopId
      ? await db.shop.findUnique({ where: { id: ctx.shopId }, select: { name: true, address: true, phone: true, taxId: true, promptPayId: true } })
      : null;

    const result = await db.shop.upsert({
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

    await AuditService.log(ctx, {
      action: 'SETTINGS_SHOP_UPDATE',
      targetType: 'Shop',
      targetId: result.id,
      beforeSnapshot: before as any,
      afterSnapshot: { name: result.name, address: result.address, phone: result.phone, taxId: result.taxId, promptPayId: result.promptPayId },
      note: 'อัปเดตข้อมูลร้านค้า',
    });

    return result;
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
