'use server';

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { saleSchema, type SaleInput } from '@/schemas/sales/sale.schema';
import { z } from 'zod';
import { ActionResponse } from '@/types/domain';
import { handleActionError } from '@/lib/error-handler';
import {
  SaleService,
  ServiceError,
  type GetSalesParams,
  type CancelSaleInput
} from '@/services';
import { serialize } from '@/lib/utils';
import { SerializedSale } from '@/types/serialized';


// =============================================================================
// SALE LIST & DETAIL
// =============================================================================

export async function getSales(params: GetSalesParams = {}) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  const result = await SaleService.getList(params, ctx, { canViewProfit });
  return serialize(result);
}


export async function getSale(id: string) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  const sale = await SaleService.getById(id, ctx, { canViewProfit });
  return serialize(sale);
}


export async function getTodaySales() {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  const result = await SaleService.getTodayAggregate(ctx, { canViewProfit });
  return serialize(result);
}


export async function getRecentSales(limit: number = 5) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  const result = await SaleService.getRecentList(limit, ctx, { canViewProfit });
  return serialize(result);
}


// =============================================================================
// SALE OPERATIONS
// =============================================================================

export async function createSale(input: SaleInput): Promise<ActionResponse<SerializedSale>> {
  const ctx = await requirePermission('SALE_CREATE');

  const validated = saleSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการขายไม่ถูกต้อง',
    };
  }

  try {
    const sale = await SaleService.create(ctx, validated.data);
    revalidatePath('/sales');
    revalidatePath('/dashboard');
    return serialize({ success: true, message: 'บันทึกการขายสำเร็จ', data: sale });
  } catch (error: unknown) {

    return handleActionError(error, 'เกิดข้อผิดพลาดในการบันทึกการขาย', { path: 'createSale', userId: ctx.userId });
  }
}

export async function cancelSale(input: CancelSaleInput) {
  const ctx = await requirePermission('SALE_CANCEL');

  try {
    await SaleService.cancel(input, ctx);
    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/expenses');
    revalidatePath('/shipments');
    revalidatePath('/dashboard');
    return { success: true, message: 'ยกเลิกรายการขายเรียบร้อย' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการยกเลิกรายการขาย', { path: 'cancelSale', userId: ctx.userId, saleId: input.id });
  }
}

// =============================================================================
// PAYMENT VERIFICATION
// =============================================================================

export async function verifyPayment(
  saleId: string,
  status: 'VERIFIED' | 'REJECTED',
  note?: string
): Promise<ActionResponse> {
  const ctx = await requirePermission('FINANCE_VIEW_LEDGER' as any);

  try {
    const sanitizedSaleId = z.string().min(1).parse(saleId);
    const sanitizedNote = note ? z.string().max(500).parse(note.trim()) : undefined;

    await SaleService.verifyPayment(sanitizedSaleId, status, sanitizedNote, ctx);
    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { success: true, message: status === 'VERIFIED' ? 'ยืนยันการชำระเงินสำเร็จ' : 'ปฏิเสธการชำระเงิน' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการตรวจสอบการชำระเงิน', { path: 'verifyPayment', userId: ctx.userId, saleId });
  }
}

export async function uploadPaymentProof(
  saleId: string,
  proofUrl: string
): Promise<ActionResponse> {
  const ctx = await requirePermission('SALE_VIEW');

  try {
    const sanitizedSaleId = z.string().min(1).parse(saleId);
    const sanitizedUrl = z.string().url().max(2048).parse(proofUrl);

    await SaleService.uploadPaymentProof(sanitizedSaleId, sanitizedUrl, ctx);
    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { success: true, message: 'อัพโหลดหลักฐานสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการอัปโหลดหลักฐาน', { path: 'uploadPaymentProof', userId: ctx.userId, saleId });
  }
}
