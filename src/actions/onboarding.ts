'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionResponse } from '@/types/action-response';
import type { Permission } from '@prisma/client';

// All permissions for auto-created Owner role
const ALL_PERMISSIONS: Permission[] = [
  'PRODUCT_VIEW', 'PRODUCT_CREATE', 'PRODUCT_EDIT', 'PRODUCT_DELETE', 'PRODUCT_VIEW_COST',
  'STOCK_VIEW_HISTORY', 'STOCK_ADJUST',
  'SALE_VIEW', 'SALE_CREATE', 'SALE_VIEW_PROFIT', 'SALE_CANCEL',
  'PURCHASE_VIEW', 'PURCHASE_CREATE', 'PURCHASE_CANCEL',
  'CUSTOMER_VIEW', 'CUSTOMER_CREATE', 'CUSTOMER_EDIT', 'CUSTOMER_DELETE',
  'EXPENSE_VIEW', 'EXPENSE_CREATE', 'EXPENSE_EDIT', 'EXPENSE_DELETE',
  'REPORT_VIEW_SALES', 'REPORT_VIEW_PROFIT', 'REPORT_EXPORT',
  'SETTINGS_SHOP', 'SETTINGS_LOOKUPS',
  'TEAM_VIEW', 'TEAM_INVITE', 'TEAM_EDIT', 'TEAM_REMOVE',
  'POS_ACCESS',
];

export async function createShop(shopName: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า' };
    }

    // Check if user already has a shop membership
    const existingMembership = await db.shopMember.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      return { success: false, message: 'คุณมีร้านค้าอยู่แล้ว' };
    }

    // Use provided name or default
    const finalShopName = shopName.trim() || `${session.user.name}'s Shop`;

    // 1. Create Shop
    const shop = await db.shop.create({
      data: {
        name: finalShopName,
        userId: userId, // Set creator as owner in Shop model (legacy support)
      },
    });

    // 2. Create Owner Role
    const ownerRole = await db.role.create({
      data: {
        name: 'Owner',
        description: 'เจ้าของร้าน - มีสิทธิ์ทั้งหมด',
        permissions: ALL_PERMISSIONS,
        isSystem: true,
        isDefault: false,
        shopId: shop.id,
      },
    });

    // 3. Create ShopMember (Owner)
    await db.shopMember.create({
      data: {
        userId: userId,
        shopId: shop.id,
        roleId: ownerRole.id,
        isOwner: true,
      },
    });

    // Revalidate paths
    revalidatePath('/');
    
    return { success: true, message: 'สร้างร้านค้าสำเร็จ' };
  } catch (error) {
    console.error('Create shop error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างร้านค้า' };
  }
}
