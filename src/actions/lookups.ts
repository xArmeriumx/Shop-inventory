'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { LookupTypeCode } from '@prisma/client';
import { LookupService, ServiceError } from '@/services';

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

export type LookupValueState = {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ==================== Read Operations ====================

export async function getLookupTypes() {
  return LookupService.getLookupTypes();
}

export async function getLookupValues(typeCode: LookupTypeCode) {
  const ctx = await requireAuth();
  return LookupService.getLookupValues(typeCode, { userId: ctx.userId, shopId: ctx.shopId as string });
}

export async function getLookupValuesForSettings(typeCode: LookupTypeCode) {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');
  return LookupService.getLookupValuesForSettings(typeCode, { userId: ctx.userId, shopId: ctx.shopId });
}

// ==================== Quick Add (for inline dropdowns) ====================

export async function quickAddCategory(
  typeCode: LookupTypeCode,
  name: string
): Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }> {
  const ctx = await requireAuth();
  
  try {
    const created = await LookupService.quickAddCategory(typeCode, name, { userId: ctx.userId, shopId: ctx.shopId as string });
    return { success: true, data: { id: created.id, name: created.name } };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, error: error.message };
    const typedError = error as Error;
    await logger.error('Quick add category error', typedError, { path: 'quickAddCategory', typeCode });
    return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

// ==================== Write Operations ====================

export async function createLookupValue(
  typeCode: LookupTypeCode,
  prevState: LookupValueState,
  formData: FormData
): Promise<LookupValueState> {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  const rawData = {
    name: formData.get('name') as string,
    color: formData.get('color') as string || undefined,
    icon: formData.get('icon') as string || undefined,
  };

  const validated = createLookupValueSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: 'ข้อมูลไม่ถูกต้อง', fieldErrors: validated.error.flatten().fieldErrors };
  }

  try {
    await LookupService.createLookupValue(typeCode, validated.data, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Create lookup value error', typedError, { path: 'createLookupValue', typeCode });
    return { error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

export async function updateLookupValue(
  id: string,
  prevState: LookupValueState,
  formData: FormData
): Promise<LookupValueState> {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  const rawData = {
    name: formData.get('name') as string || undefined,
    color: formData.get('color') as string || undefined,
    icon: formData.get('icon') as string || undefined,
  };

  const validated = updateLookupValueSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: 'ข้อมูลไม่ถูกต้อง', fieldErrors: validated.error.flatten().fieldErrors };
  }

  try {
    await LookupService.updateLookupValue(id, validated.data, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Update lookup value error', typedError, { path: 'updateLookupValue', lookupId: id });
    return { error: 'เกิดข้อผิดพลาดในการบันทึก' };
  }
}

export async function deleteLookupValue(id: string): Promise<LookupValueState> {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  try {
    await LookupService.deleteLookupValue(id, { userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Delete lookup value error', typedError, { path: 'deleteLookupValue', lookupId: id });
    return { error: 'เกิดข้อผิดพลาดในการลบ' };
  }
}

export async function seedDefaultLookupValues() {
  const ctx = await requirePermission('SETTINGS_LOOKUPS');

  try {
    await LookupService.seedDefaultLookupValues({ userId: ctx.userId, shopId: ctx.shopId });
    revalidatePath('/settings');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Seed default values error', typedError, { path: 'seedDefaultLookupValues' });
    return { error: 'เกิดข้อผิดพลาด' };
  }
}
