'use server';

import { requireShop } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { AiService } from '@/services/core/intelligence/ai.service';
import { AiPromptBuilder } from '@/lib/ai/ai-prompt-builder';

/**
 * Get shop context data for AI
 * This provides relevant data for the AI to answer questions
 */
export async function getShopContextForAI(): Promise<string> {
  const ctx = await requireShop();

  try {
    const rawData = await AiService.getShopContext(ctx);
    return AiPromptBuilder.buildShopContextPrompt(rawData);
  } catch (error) {
    const typedError = error as Error;
    await logger.error('Error getting shop context for AI', typedError, {
      path: 'getShopContextForAI',
      shopId: ctx.shopId
    });
    return `## ข้อมูลร้าน\nเกิดข้อผิดพลาดในการโหลดข้อมูลส่วนตัวของร้านค้า กรุณาลองใหม่อีกครั้ง`;
  }
}
