'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { z } from 'zod';
import { ReturnService } from '@/services';
import { ActionResponse } from '@/types/common';
import { handleActionError } from '@/lib/error-handler';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

// =============================================================================
// G3: Partial Returns (คืนสินค้าบางส่วน)
// =============================================================================

const returnItemSchema = z.object({
  saleItemId: z.string().min(1, 'กรุณาเลือกรายการสินค้า'),
  productId: z.string().min(1, 'ไม่พบสินค้า'),
  quantity: z.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
  refundPerUnit: z.number().min(0, 'ราคาคืนต้องไม่ติดลบ'),
});

const createReturnSchema = z.object({
  saleId: z.string().min(1, 'กรุณาเลือกบิลขาย'),
  reason: z.string().min(1, 'กรุณาระบุเหตุผล').max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
  refundMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกวิธีคืนเงิน' }),
  }),
  items: z.array(returnItemSchema).min(1, 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'),
});

type CreateReturnInput = z.infer<typeof createReturnSchema>;

/**
 * ดูรายการสินค้าที่คืนได้จากบิลขาย
 */
export async function getReturnableSaleItems(saleId: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('RETURN_CREATE' as any);
      return ReturnService.getReturnableSaleItems(saleId, ctx);
    }, 'returns:getReturnableSaleItems');
  }, { context: { action: 'getReturnableSaleItems', saleId } });
}

/**
 * สร้างรายการคืนสินค้า
 */
export async function createReturn(input: CreateReturnInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('RETURN_CREATE');
      const data = createReturnSchema.parse(input);
      const result = await ReturnService.create(data, ctx);

      revalidatePath('/sales');
      revalidatePath(`/sales/${data.saleId}`);
      revalidatePath('/returns');
      revalidatePath('/dashboard');

      return result;
    });
  }, { context: { action: 'createReturn', saleId: input.saleId } });
}

/**
 * ดูรายการคืนสินค้าทั้งหมดของร้าน
 */
export async function getReturns(options?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('RETURN_VIEW' as any);
      return ReturnService.getList(options || {}, ctx);
    }, 'returns:getReturns');
  }, { context: { action: 'getReturns' } });
}

/**
 * ดูรายละเอียดการคืนสินค้า
 */
export async function getReturnById(returnId: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('RETURN_VIEW' as any);
      return ReturnService.getById(returnId, ctx);
    }, 'returns:getReturnById');
  }, { context: { action: 'getReturnById', returnId } });
}
