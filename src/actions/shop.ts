'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission, requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';

const shopSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อร้าน'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  taxId: z.string().optional(),
  promptPayId: z.string().optional(),
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
  // Pass to service - usage of optional shopId is handled inside the service logic
  return SettingsService.getShop({ userId: ctx.userId, shopId: ctx.shopId as string });
}

export async function updateShop(prevState: ShopState, formData: FormData): Promise<ShopState> {
  const ctx = await requirePermission('SETTINGS_SHOP');
  
  const rawFormData = {
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    phone: formData.get('phone') || undefined,
    logo: formData.get('logo') || undefined,
    taxId: formData.get('taxId') || undefined,
    promptPayId: formData.get('promptPayId') || undefined,
  };

  const validatedFields = shopSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    await SettingsService.updateShop(validatedFields.data, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/settings');
    revalidatePath('/sales');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Update shop error', typedError, { path: 'updateShop', userId: ctx.userId });
    return { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}
