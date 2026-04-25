'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

import { profileFormSchema } from '@/schemas/core/settings-form.schema';

// Removed ProfileState as we use standard ActionResponse<T>

export async function updateProfile(data: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requireAuth();
    const validated = profileFormSchema.parse(data);

    await SettingsService.updateUserProfile(ctx as unknown as import('@/types/domain').RequestContext, validated);

    revalidatePath('/settings');
    revalidatePath('/dashboard');

    return null;
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
