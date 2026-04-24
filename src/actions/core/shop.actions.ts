'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requirePermission, requireAuth } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { SettingsService, ServiceError } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

const shopSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อร้าน'),
  address: z.string().optional(),
  phone: z.string().optional(),
  logo: z.string().optional(),
  taxId: z.string().optional(),
  promptPayId: z.string().optional(),
});

// Removed ShopState as we use standard ActionResponse<T>

export async function getShop(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireAuth();
      return SettingsService.getShop(ctx as unknown as import('@/types/domain').RequestContext);
    }, 'shop:getShop');
  }, { context: { action: 'getShop' } });
}

export async function updateShop(data: z.infer<typeof shopSchema>): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP');
      const validated = shopSchema.parse(data);

      await SettingsService.updateShop(validated, ctx);

      revalidatePath('/settings');
      revalidatePath('/sales');

      return null;
    }, 'shop:updateShop');
  }, { context: { action: 'updateShop' } });
}
