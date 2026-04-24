import { db, runInTransaction } from '@/lib/db';
import type { Permission } from '@prisma/client';

const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_VOID',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE',
  'REPORT_VIEW_SALES', 'REPORT_VIEW_SALES', 'REPORT_EXPORT',
  'SETTINGS_SHOP', 'SETTINGS_SHOP',
  'SETTINGS_ROLES', 'SETTINGS_ROLES', 'SETTINGS_ROLES', 'SETTINGS_ROLES',
  'POS_ACCESS',
];

export const OnboardingService = {
  async createShop(userId: string, shopName: string, userName?: string | null) {
    // 1. Check if user already has a shop membership
    const existingMembership = await db.shopMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new Error('คุณมีร้านค้าอยู่แล้ว');
    }

    const finalShopName = shopName.trim() || `${userName || 'User'}'s Shop`;

    return runInTransaction(undefined, async (prisma) => {
      // 2. Create Shop
      const shop = await prisma.shop.create({
        data: {
          name: finalShopName,
          userId: userId,
        },
      });

      // 3. Create Owner Role
      const ownerRole = await prisma.role.create({
        data: {
          name: 'Owner',
          description: 'เจ้าของร้าน - มีสิทธิ์ทั้งหมด',
          permissions: ALL_PERMISSIONS,
          isSystem: true,
          isDefault: false,
          shopId: shop.id,
        },
      });

      // 4. Create ShopMember (Owner)
      await prisma.shopMember.create({
        data: {
          userId: userId,
          shopId: shop.id,
          roleId: ownerRole.id,
          isOwner: true,
        },
      });

      return shop;
    });
  }
};
