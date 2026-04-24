'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { LookupTypeCode } from '@prisma/client';
import { LookupService, ServiceError } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

// ==================== Schemas ====================

const createLookupValueSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อ'),
  color: z.string().optional(),
  icon: z.string().optional(),
});

const updateLookupValueSchema = z.object({
  name: z.string().min(1, 'กรุณาระบุชื่อ').optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

// ==================== Types ====================

// Removed LookupValueState as we use standard ActionResponse<T>

// ==================== Read Operations ====================

// ==================== Read Operations ====================

export async function getLookupTypes(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      return LookupService.getLookupTypes();
    }, 'lookups:getLookupTypes');
  }, { context: { action: 'getLookupTypes' } });
}

export async function getLookupValues(typeCode: LookupTypeCode): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireAuth();
      return LookupService.getLookupValues(typeCode, ctx as unknown as import('@/types/domain').RequestContext);
    }, 'lookups:getLookupValues');
  }, { context: { action: 'getLookupValues', typeCode } });
}

export async function getLookupValuesForSettings(typeCode: LookupTypeCode): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP' as any);
      return LookupService.getLookupValuesForSettings(typeCode, ctx);
    }, 'lookups:getLookupValuesForSettings');
  }, { context: { action: 'getLookupValuesForSettings', typeCode } });
}

// ==================== Quick Add (for inline dropdowns) ====================

export async function quickAddCategory(
  typeCode: LookupTypeCode,
  name: string
): Promise<ActionResponse<{ id: string; name: string }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireAuth();
      const created = await LookupService.quickAddCategory(
        typeCode,
        name,
        ctx as unknown as import('@/types/domain').RequestContext
      );
      return { id: created.id, name: created.name };
    }, 'lookups:quickAddCategory');
  }, { context: { action: 'quickAddCategory', typeCode } });
}

// ==================== Write Operations ====================

export async function createLookupValue(
  typeCode: LookupTypeCode,
  prevState: any,
  formData: FormData
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP');

      const rawData = {
        name: formData.get('name') as string,
        color: formData.get('color') as string || undefined,
        icon: formData.get('icon') as string || undefined,
      };

      const validated = createLookupValueSchema.parse(rawData);
      await LookupService.createLookupValue(typeCode, validated, ctx);
      revalidatePath('/settings');
      return null;
    }, 'lookups:createLookupValue');
  }, { context: { action: 'createLookupValue', typeCode } });
}

export async function updateLookupValue(
  id: string,
  prevState: any,
  formData: FormData
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP');

      const rawData = {
        name: formData.get('name') as string || undefined,
        color: formData.get('color') as string || undefined,
        icon: formData.get('icon') as string || undefined,
      };

      const validated = updateLookupValueSchema.parse(rawData);
      await LookupService.updateLookupValue(id, validated, ctx);
      revalidatePath('/settings');
      return null;
    }, 'lookups:updateLookupValue');
  }, { context: { action: 'updateLookupValue', id } });
}

export async function deleteLookupValue(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP');
      await LookupService.deleteLookupValue(id, ctx);
      revalidatePath('/settings');
      return null;
    }, 'lookups:deleteLookupValue');
  }, { context: { action: 'deleteLookupValue', id } });
}

export async function seedDefaultLookupValues(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP' as any);
      await LookupService.seedDefaultLookupValues(ctx);
      revalidatePath('/settings');
      return null;
    }, 'lookups:seedDefaultLookupValues');
  }, { context: { action: 'seedDefaultLookupValues' } });
}
