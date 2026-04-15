'use server';

import { requireShop } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { AiService } from '@/services';

/**
 * Get shop context data for AI
 * This provides relevant data for the AI to answer questions
 */
export async function getShopContextForAI() {
  const ctx = await requireShop();

  try {
    return await AiService.getShopContextForAI({ userId: ctx.userId, shopId: ctx.shopId });
  } catch (error) {
    const typedError = error as Error;
    await logger.error('Error getting shop context for AI', typedError, { path: 'getShopContextForAI' });
    return `## ข้อมูลร้าน
เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง`;
  }
}
