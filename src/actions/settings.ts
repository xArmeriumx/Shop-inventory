'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

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
  const userId = await getCurrentUserId();
  
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
    await db.user.update({
      where: { id: userId },
      data: {
        name: validatedFields.data.name,
      },
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard'); // Update header name
    
    return { success: true };
  } catch (error) {
    await logger.error('Update profile error', error as Error, { path: 'updateProfile', userId });
    return { error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
  }
}

export async function getUserProfile() {
  const userId = await getCurrentUserId();
  
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}
