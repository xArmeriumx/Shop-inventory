'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { supplierSchema, type SupplierInput } from '@/schemas/purchases/supplier.schema';
import { SupplierService } from '@/services';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';

/**
 * Get suppliers for selection in forms
 */
export async function getSuppliersForSelect(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return SupplierService.getForSelect(ctx);
    }, 'purchases:getSuppliersForSelect');
  }, { context: { action: 'getSuppliersForSelect' } });
}

/**
 * Get paginated list of suppliers
 */
export async function getSuppliers(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW' as any);
      return SupplierService.getAll(ctx, params);
    }, 'purchases:getSuppliers');
  }, { context: { action: 'getSuppliers', ...params } });
}

/**
 * Get supplier by ID
 */
export async function getSupplier(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW' as any);
      return SupplierService.getById(id, ctx);
    }, 'purchases:getSupplier');
  }, { context: { action: 'getSupplier', id } });
}

/**
 * Create a new supplier
 */
export async function createSupplier(input: SupplierInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE' as any);
      const validated = supplierSchema.parse(input);
      const result = await SupplierService.create(ctx, validated);
      revalidatePath('/suppliers');
      return result;
    }, 'purchases:createSupplier');
  }, { context: { action: 'createSupplier' } });
}

/**
 * Update an existing supplier
 */
export async function updateSupplier(id: string, input: SupplierInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_UPDATE' as any);
      const validated = supplierSchema.parse(input);
      const result = await SupplierService.update(id, ctx, validated);
      revalidatePath('/suppliers');
      revalidatePath(`/suppliers/${id}`);
      return result;
    }, 'purchases:updateSupplier');
  }, { context: { action: 'updateSupplier', id } });
}

/**
 * Delete (Void) a supplier
 */
export async function deleteSupplier(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VOID' as any);
      const result = await SupplierService.delete(id, ctx);
      revalidatePath('/suppliers');
      return result;
    }, 'purchases:deleteSupplier');
  }, { context: { action: 'deleteSupplier', id } });
}

/**
 * Get detailed supplier profile
 */
export async function getSupplierProfile(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return SupplierService.getProfile(id, ctx);
    }, 'purchases:getSupplierProfile');
  }, { context: { action: 'getSupplierProfile', id } });
}
