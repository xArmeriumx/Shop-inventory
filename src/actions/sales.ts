'use server';

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { requirePermission, hasPermission } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { saleSchema, type SaleInput } from '@/schemas/sale';
import { z } from 'zod';
import type { Sale, SaleItem, Prisma } from '@prisma/client';

import type { ActionResponse } from '@/types/domain';
import { money, toNumber, calcSubtotal, calcProfit } from '@/lib/money';

// =============================================================================
// UTILITIES
// =============================================================================

import { 
  StockService, 
  SaleService, 
  ServiceError, 
  type GetSalesParams, 
  type CancelSaleInput,
  type SerializedSale 
} from '@/services';

// ดึงข้อมูลการขายทั้งหมด (Pagination)
export async function getSales(params: GetSalesParams = {}) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  
  return SaleService.getList(params, ctx, { canViewProfit });
}

// ดึงข้อมูลการขายตาม ID
export async function getSale(id: string) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  try {
    return await SaleService.getById(id, ctx, { canViewProfit });
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

// สร้างการขายใหม่
export async function createSale(input: SaleInput): Promise<ActionResponse<SerializedSale>> {
  // RBAC: Require SALE_CREATE permission
  const ctx = await requirePermission('SALE_CREATE');

  // Validate input
  const validated = saleSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการขายไม่ถูกต้อง',
    };
  }

  try {
    const sale = await SaleService.create(
      ctx, 
      validated.data
    );

    revalidatePath('/sales');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'บันทึกการขายสำเร็จ',
      data: sale,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    const typedError = error as Error;
    await logger.error('Failed to create sale', typedError, { 
      path: 'createSale', 
      userId: ctx.userId,
      input 
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย',
    };
  }
}

// ยกเลิกการขาย (Soft Cancel + คืนสต็อก)
export async function cancelSale(input: CancelSaleInput) {
  const ctx = await requirePermission('SALE_CANCEL');
  
  try {
    await SaleService.cancel(input, ctx);

    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/expenses');
    revalidatePath('/shipments');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { error: error.message };
    const typedError = error as Error;
    await logger.error('Failed to cancel sale', typedError, { 
      path: 'cancelSale', 
      userId: ctx.userId, 
      saleId: input.id,
    });
    return { error: typedError.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' };
  }
}

// สรุปยอดขายวันนี้ (Aggregate)
export async function getTodaySales() {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');
  
  return SaleService.getTodayAggregate(ctx, { canViewProfit });
}

export async function getRecentSales(limit: number = 5) {
  const ctx = await requirePermission('SALE_VIEW');
  const canViewProfit = hasPermission(ctx, 'SALE_VIEW_PROFIT');

  return SaleService.getRecentList(limit, ctx, { canViewProfit });
}

// =================================================================
// G1: Payment Verification Actions
// =================================================================

/**
 * ตรวจสอบหลักฐานการชำระเงิน (Verify / Reject)
 */
export async function verifyPayment(
  saleId: string, 
  status: 'VERIFIED' | 'REJECTED', 
  note?: string
): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('PAYMENT_VERIFY');

    // Input sanitization
    const sanitizedSaleId = z.string().min(1).safeParse(saleId);
    if (!sanitizedSaleId.success) return { success: false, message: 'รหัสรายการขายไม่ถูกต้อง' };
    
    const sanitizedNote = note ? z.string().max(500).safeParse(note.trim()) : undefined;
    if (sanitizedNote && !sanitizedNote.success) return { success: false, message: 'หมายเหตุยาวเกินไป (สูงสุด 500 ตัวอักษร)' };

    await SaleService.verifyPayment(sanitizedSaleId.data, status, sanitizedNote?.data, ctx);

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { success: true, message: status === 'VERIFIED' ? 'ยืนยันการชำระเงินสำเร็จ' : 'ปฏิเสธการชำระเงิน' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    return { success: false, message: (error as Error).message || 'เกิดข้อผิดพลาด' };
  }
}

/**
 * อัพโหลดหลักฐานการชำระเงิน (สลิป)
 */
export async function uploadPaymentProof(
  saleId: string, 
  proofUrl: string
): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('SALE_VIEW');

    // Input sanitization
    const sanitizedSaleId = z.string().min(1).safeParse(saleId);
    if (!sanitizedSaleId.success) return { success: false, message: 'รหัสรายการขายไม่ถูกต้อง' };
    
    const sanitizedUrl = z.string().url().max(2048).safeParse(proofUrl);
    if (!sanitizedUrl.success) return { success: false, message: 'URL หลักฐานไม่ถูกต้อง' };

    await SaleService.uploadPaymentProof(sanitizedSaleId.data, sanitizedUrl.data, ctx);

    revalidatePath('/sales');
    revalidatePath(`/sales/${saleId}`);
    return { success: true, message: 'อัพโหลดหลักฐานสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    return { success: false, message: (error as Error).message || 'เกิดข้อผิดพลาด' };
  }
}
