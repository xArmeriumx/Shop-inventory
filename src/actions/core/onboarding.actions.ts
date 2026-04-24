'use server';

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import type { ActionResponse } from '@/types/domain';
import { OnboardingService } from '@/services';

export async function createShop(shopName: string): Promise<ActionResponse> {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า' };
    }

    await OnboardingService.createShop(userId, shopName, session.user.name);

    // Revalidate paths
    revalidatePath('/');
    
    return { success: true, message: 'สร้างร้านค้าสำเร็จ' };
  } catch (error: unknown) {
    const typedError = error as Error;
    await logger.error('Create shop error', typedError, { path: 'createShop' });
    return { success: false, message: typedError.message || 'เกิดข้อผิดพลาดในการสร้างร้านค้า' };
  }
}
