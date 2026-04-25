'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission, requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

import { shopFormSchema } from '@/schemas/core/settings-form.schema';

export async function getShop(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requireAuth();
    return SettingsService.getShop(ctx as unknown as import('@/types/domain').RequestContext);
  }, { context: { action: 'getShop' } });
}

export async function updateShop(data: any): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    const validated = shopFormSchema.parse(data);

    await SettingsService.updateShop(validated, ctx);

    revalidatePath('/settings');
    revalidatePath('/sales');

    return null;
  }, { context: { action: 'updateShop' } });
}
