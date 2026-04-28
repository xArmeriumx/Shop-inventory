'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { LookupTypeCode } from '@prisma/client';
import { LookupService } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { lookupValueSchema } from '@/schemas/core/lookup.schema';
import { AuditService } from '@/services/core/system/audit.service';

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
      return LookupService.getLookupValues(typeCode, ctx as any);
    }, 'lookups:getLookupValues');
  }, { context: { action: 'getLookupValues', typeCode } });
}

export async function getLookupValuesForSettings(typeCode: LookupTypeCode): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SETTINGS_SHOP');
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
    // FIX: Tighten permission for quick add to prevent data pollution
    const ctx = await requirePermission('SETTINGS_SHOP');
    
    const created = await LookupService.quickAddCategory(typeCode, name, ctx);
    
    // Audit
    AuditService.record({
        action: 'QUICK_ADD_CATEGORY',
        targetType: 'LookupValue',
        targetId: created.id,
        note: `Quick added category: ${name} (${typeCode})`,
        after: created,
        actorId: ctx.userId,
        shopId: ctx.shopId
    }).catch(err => logger.error('[Audit] QUICK_ADD_CATEGORY failed', err));

    return { id: created.id, name: created.name };
  }, { context: { action: 'quickAddCategory', typeCode } });
}

// ==================== Write Operations (Modern Pattern) ====================

export async function createLookupValue(
  typeCode: LookupTypeCode,
  input: any
): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    const validated = lookupValueSchema.parse(input);
    
    const result = await LookupService.createLookupValue(typeCode, validated, ctx);

    // Audit
    AuditService.record({
        action: 'CREATE_LOOKUP',
        targetType: 'LookupValue',
        targetId: result.id,
        note: `Created lookup: ${result.name} (${typeCode})`,
        after: result,
        actorId: ctx.userId,
        shopId: ctx.shopId
    }).catch(err => logger.error('[Audit] CREATE_LOOKUP failed', err));

    revalidatePath('/settings/categories');
    return result;
  }, { context: { action: 'createLookup', typeCode } });
}

export async function updateLookupValue(
  id: string,
  input: any
): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    
    const before = await LookupService.getLookupValueById(id, ctx);
    const validated = lookupValueSchema.partial().parse(input);
    
    const result = await LookupService.updateLookupValue(id, validated, ctx);

    // Audit
    AuditService.record({
        action: 'UPDATE_LOOKUP',
        targetType: 'LookupValue',
        targetId: id,
        note: `Updated lookup: ${result.name}`,
        before,
        after: result,
        actorId: ctx.userId,
        shopId: ctx.shopId
    }).catch(err => logger.error('[Audit] UPDATE_LOOKUP failed', err));

    revalidatePath('/settings/categories');
    return result;
  }, { context: { action: 'updateLookup', id } });
}

export async function deleteLookupValue(id: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    
    const before = await LookupService.getLookupValueById(id, ctx);
    await LookupService.deleteLookupValue(id, ctx);

    // Audit
    AuditService.record({
        action: 'DELETE_LOOKUP',
        targetType: 'LookupValue',
        targetId: id,
        note: `Deleted lookup: ${before?.name}`,
        before,
        actorId: ctx.userId,
        shopId: ctx.shopId
    }).catch(err => logger.error('[Audit] DELETE_LOOKUP failed', err));

    revalidatePath('/settings/categories');
    return null;
  }, { context: { action: 'deleteLookup', id } });
}

export async function seedDefaultLookupValues(): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SETTINGS_SHOP');
    await LookupService.seedDefaultLookupValues(ctx);
    
    revalidatePath('/settings/categories');
    return null;
  }, { context: { action: 'seedDefaultLookup' } });
}
