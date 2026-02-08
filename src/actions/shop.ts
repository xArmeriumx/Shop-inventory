'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

const shopSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อร้าน'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  taxId: z.string().optional(),
});

export type ShopState = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    name?: string[];
    address?: string[];
    phone?: string[];
    logo?: string[];
    taxId?: string[];
  };
};

export async function getShop() {
  const ctx = await requireAuth();
  
  // If user has a shopId in session, fetch that shop
  if (ctx.shopId) {
    return db.shop.findUnique({
      where: { id: ctx.shopId },
    });
  }

  // Fallback: Check if user owns a shop (legacy or if session stale)
  const shop = await db.shop.findUnique({
    where: { userId: ctx.userId },
  });

  return shop;
}



export async function updateShop(prevState: ShopState, formData: FormData): Promise<ShopState> {
  // RBAC: Require SETTINGS_SHOP permission
  const ctx = await requirePermission('SETTINGS_SHOP');
  
  const rawFormData = {
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
    logo: formData.get('logo') || undefined,
    taxId: formData.get('taxId') || undefined,
  };

  const validatedFields = shopSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    await db.shop.upsert({
      where: { userId: ctx.userId },
      update: {
        name: validatedFields.data.name,
        address: validatedFields.data.address,
        phone: validatedFields.data.phone,
        logo: validatedFields.data.logo,
        taxId: validatedFields.data.taxId,
      },
      create: {
        userId: ctx.userId,
        name: validatedFields.data.name,
        address: validatedFields.data.address,
        phone: validatedFields.data.phone,
        logo: validatedFields.data.logo,
        taxId: validatedFields.data.taxId,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/sales');
    
    return { success: true };
  } catch (error) {
    await logger.error('Update shop error', error as Error, { path: 'updateShop', userId: ctx.userId });
    return { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}
