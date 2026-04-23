import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { Security } from '@/services/core/security.service';
import { AuditService, AUDIT_ACTIONS } from '@/services/core/audit.service';

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

    // allowlist for shop settings (Rule 12.1 - Flat + Allowlist Policy)
    const allowlist = ['name', 'address', 'phone', 'taxId', 'promptPayId', 'latitude', 'longitude'];

    return AuditService.runWithAudit(
      ctx,
      {
        action: AUDIT_ACTIONS.SHOP_UPDATE,
        targetType: 'Shop',
        allowlist,
        getBefore: async () => {
          if (!ctx.shopId) return null;
          return db.shop.findUnique({ where: { id: ctx.shopId } });
        },
        note: 'อัปเดตข้อมูลร้านค้าผ่านตัวช่วย Audit อัตโนมัติ',
      },
      async () => {
        // Main business logic (Flexible Policy - service controls transaction if needed)
        return db.shop.upsert({
          where: { userId: ctx.userId },
          update: {
            name: data.name,
            address: data.address,
            phone: data.phone,
            logo: data.logo,
            taxId: data.taxId,
            promptPayId: data.promptPayId,
            latitude: data.latitude,
            longitude: data.longitude,
          },
          create: {
            userId: ctx.userId,
            name: data.name,
            address: data.address,
            phone: data.phone,
            logo: data.logo,
            taxId: data.taxId,
            promptPayId: data.promptPayId,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });
      }
    );
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
