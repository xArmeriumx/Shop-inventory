'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';

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
  const userId = await getCurrentUserId();
  
  const shop = await db.shop.findUnique({
    where: { userId },
  });

  return shop;
}

export async function createShopIfNotExists() {
  const userId = await getCurrentUserId();
  
  const existingShop = await db.shop.findUnique({
    where: { userId },
  });

  if (existingShop) {
    return existingShop;
  }

  // Get user name for default shop name
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const defaultName = user?.name || user?.email?.split('@')[0] || 'ร้านของฉัน';

  const shop = await db.shop.create({
    data: {
      userId,
      name: defaultName,
    },
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
    console.error('Update shop error:', error);
    return { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}
