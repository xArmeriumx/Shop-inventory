'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';

const profileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
});

export type ProfileState = {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    name?: string[];
  };
};

export async function updateProfile(prevState: ProfileState, formData: FormData): Promise<ProfileState> {
  const ctx = await requireAuth();
  const userId = ctx.userId;
  
  const rawFormData = {
    name: formData.get('name'),
  };

  const validatedFields = profileSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    return {
      error: 'ข้อมูลไม่ถูกต้อง',
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    await SettingsService.updateUserProfile(userId, validatedFields.data as { name: string });
    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Update profile error', typedError, { path: 'updateProfile', userId });
    return { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function getUserProfile() {
  const ctx = await requireAuth();
  const userId = ctx.userId;
  try {
    return await SettingsService.getUserProfile(userId);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}
