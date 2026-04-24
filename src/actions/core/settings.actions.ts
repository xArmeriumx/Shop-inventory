'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

const profileSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อ'),
});

// Removed ProfileState as we use standard ActionResponse<T>

export async function updateProfile(data: { name: string }): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireAuth();
      const validated = profileSchema.parse(data);

      await SettingsService.updateUserProfile(ctx.userId, validated);

      revalidatePath('/settings');
      revalidatePath('/dashboard');

      return null;
    }, 'settings:updateProfile');
  }, { context: { action: 'updateProfile' } });
}

export async function getUserProfile(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireAuth();
      return SettingsService.getUserProfile(ctx.userId);
    }, 'settings:getUserProfile');
  }, { context: { action: 'getUserProfile' } });
}
