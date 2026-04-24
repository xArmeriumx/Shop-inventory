'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchases/purchase.schema';
import { handleActionError } from '@/lib/error-handler';
import { PurchaseService, type GetPurchasesParams, type CancelPurchaseInput } from '@/services';
import { ActionResponse } from '@/types/common';
import { SerializedPurchase } from '@/types/serialized';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

// =============================================================================
// PURCHASE LIST & DETAIL
// =============================================================================

export async function getPurchases(params: GetPurchasesParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return PurchaseService.getList(params, ctx);
    }, 'purchases:getPurchases');
  }, { context: { action: 'getPurchases' } });
}


export async function getPurchase(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return PurchaseService.getById(id, ctx);
    }, 'purchases:getPurchase');
  }, { context: { action: 'getPurchase', id } });
}


// =============================================================================
// PURCHASE OPERATIONS
// =============================================================================

export async function createPurchase(input: PurchaseInput): Promise<ActionResponse<SerializedPurchase>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      const validated = purchaseSchema.parse(input);

      const purchase = await PurchaseService.create(ctx, validated);
      revalidatePath('/purchases');
      revalidatePath('/products');
      revalidatePath('/dashboard');
      return purchase;
    }, 'purchases:createPurchase');
  }, { context: { action: 'createPurchase' } });
}

export async function createPurchaseRequest(input: PurchaseInput): Promise<ActionResponse<{ id: string; requestNumber: string }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      const validated = purchaseSchema.parse(input);

      const result = await PurchaseService.createRequest(validated, ctx);
      revalidatePath('/purchases');
      return result;
    }, 'purchases:createPurchaseRequest');
  }, { context: { action: 'createPurchaseRequest' } });
}

export async function approvePurchaseRequest(id: string): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('APPROVAL_ACTION');
      await PurchaseService.approveRequest(id, ctx);
      revalidatePath('/purchases');
      revalidatePath(`/purchases/${id}`);
    }, 'purchases:approvePurchaseRequest');
  }, { context: { action: 'approvePurchaseRequest', prId: id } });
}

export async function convertToPurchaseOrder(id: string): Promise<ActionResponse<{ id: string; poNumber: string }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      const result = await PurchaseService.convertToPO(id, ctx);
      revalidatePath('/purchases');
      revalidatePath('/products');
      return result;
    }, 'purchases:convertToPurchaseOrder');
  }, { context: { action: 'convertToPurchaseOrder', prId: id } });
}

export async function cancelPurchase(input: CancelPurchaseInput): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VOID');
      await PurchaseService.cancel(input, ctx);
      revalidatePath('/purchases');
      revalidatePath('/products');
      revalidatePath('/dashboard');
    }, 'purchases:cancelPurchase');
  }, { context: { action: 'cancelPurchase', purchaseId: input.id } });
}

export async function receivePurchase(id: string): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      await PurchaseService.receivePurchase(id, ctx);
      revalidatePath('/purchases');
      revalidatePath('/products');
      revalidatePath('/dashboard');
    }, 'purchases:receivePurchase');
  }, { context: { action: 'receivePurchase', purchaseId: id } });
}

/**
 * Bulk create draft PRs from suggested reorder items (Merged from purchase.actions.ts)
 */
export async function createPRFromSuggestions(entries: { productId: string, quantity: number, supplierId?: string }[]): Promise<ActionResponse<{ createdCount: number }>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      const result = await PurchaseService.createBulkDraftPRs(entries, ctx);
      revalidatePath('/purchases');
      revalidatePath('/intelligence');
      return result;
    }, 'purchases:createPRFromSuggestions');
  }, { context: { action: 'createPRFromSuggestions', entryCount: entries.length } });
}
