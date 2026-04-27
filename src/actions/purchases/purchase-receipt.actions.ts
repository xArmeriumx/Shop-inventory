'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { PurchaseReceiptService } from '@/services/purchases/purchase-receipt.service';
import * as PurchaseReceivingService from '@/services/purchases/purchase-receiving.service';
import { purchaseReceiptSchema, type PurchaseReceiptInput } from '@/schemas/purchases/purchase-receipt-form';
import { ActionResponse } from '@/types/common';

// ... (existing functions)

export async function getPendingReceiving(params: { page?: number; limit?: number }): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      return PurchaseReceivingService.getPendingPurchaseOrders(ctx as any, params);
    }, 'purchases:getPendingReceiving');
  }, { context: { action: 'getPendingReceiving' } });
}

export async function getPurchaseOrderForReceiving(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      return PurchaseReceivingService.getPurchaseOrderItemsForReceiving(ctx as any, id);
    }, 'purchases:getPurchaseOrderForReceiving');
  }, { context: { action: 'getPurchaseOrderForReceiving', id } });
}

export async function createPurchaseReceipt(input: PurchaseReceiptInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_CREATE');
      const validated = purchaseReceiptSchema.parse(input);

      const result = await PurchaseReceiptService.createReceipt(ctx, validated);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }
      
      return result.data;
    }, 'purchases:createPurchaseReceipt');
  }, { context: { action: 'createPurchaseReceipt', purchaseId: input.purchaseId } });
}

export async function getPurchaseReceipts(params: any): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return PurchaseReceiptService.getReceipts(ctx, params);
    }, 'purchases:getPurchaseReceipts');
  }, { context: { action: 'getPurchaseReceipts' } });
}

export async function getPurchaseReceipt(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PURCHASE_VIEW');
      return PurchaseReceiptService.getReceiptById(ctx, id);
    }, 'purchases:getPurchaseReceipt');
  }, { context: { action: 'getPurchaseReceipt', id } });
}
