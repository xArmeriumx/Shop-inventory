'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission, hasPermission, requireShop } from '@/lib/auth-guard';
import { saleSchema, type SaleInput } from '@/schemas/sales/sale.schema';
import { z } from 'zod';
import { ActionResponse } from '@/types/common';
import {
  SaleService,
  type GetSalesParams,
  type CancelSaleInput
} from '@/services';
import { SaleDetailDTO } from '@/types/dtos/sales.dto';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

// =============================================================================
// SALE LIST & DETAIL
// =============================================================================

export async function getSales(params: GetSalesParams = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_VIEW');
      const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
      return SaleService.getList(params, ctx, { canViewProfit });
    }, 'sales:getSales');
  }, { context: { action: 'getSales' } });
}


export async function getSale(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_VIEW');
      const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
      return SaleService.getById(id, ctx, { canViewProfit });
    }, 'sales:getSale');
  }, { context: { action: 'getSale', id } });
}


export async function getTodaySales(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_VIEW');
      const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
      return SaleService.getTodayAggregate(ctx, { canViewProfit });
    }, 'sales:getTodaySales');
  }, { context: { action: 'getTodaySales' } });
}


export async function getRecentSales(limit: number = 5): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_VIEW');
      const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
      return SaleService.getRecentList(limit, ctx, { canViewProfit });
    }, 'sales:getRecentSales');
  }, { context: { action: 'getRecentSales' } });
}


// =============================================================================
// SALE OPERATIONS
// =============================================================================

export async function createSale(input: SaleInput): Promise<ActionResponse<SaleDetailDTO>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_CREATE');
      const validated = saleSchema.parse(input);

      const result = await SaleService.create(ctx, validated);

      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }
      
      return result.data;
    }, 'sales:createSale');
  }, { context: { action: 'createSale' } });
}

export async function cancelSale(input: CancelSaleInput): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('SALE_CANCEL');
      
      const result = await SaleService.cancel(input, ctx);

      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return null;
    }, 'sales:cancelSale');
  }, { context: { action: 'cancelSale', saleId: input.id } });
}

// =============================================================================
// PAYMENT VERIFICATION
// =============================================================================

export async function verifyPayment(
  saleId: string,
  status: 'VERIFIED' | 'REJECTED',
  note?: string
): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
      const sanitizedSaleId = z.string().min(1).parse(saleId);
      const sanitizedNote = note ? z.string().max(500).parse(note.trim()) : undefined;

      const result = await SaleService.verifyPayment(sanitizedSaleId, status, sanitizedNote, ctx);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return null;
    }, 'sales:verifyPayment');
  }, { context: { action: 'verifyPayment', saleId } });
}

export async function uploadPaymentProof(
  saleId: string,
  proofUrl: string
): Promise<ActionResponse> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      const sanitizedSaleId = z.string().min(1).parse(saleId);
      const sanitizedUrl = z.string().url().max(2048).parse(proofUrl);

      const result = await SaleService.uploadPaymentProof(sanitizedSaleId, sanitizedUrl, ctx);
      
      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return null;
    }, 'sales:uploadPaymentProof');
  }, { context: { action: 'uploadPaymentProof', saleId } });
}
