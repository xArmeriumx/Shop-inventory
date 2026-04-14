'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { z } from 'zod';
import { ReturnService, ServiceError } from '@/services';
import type { ActionResponse } from '@/types/action-response';

// =============================================================================
// G3: Partial Returns (คืนสินค้าบางส่วน)
// =============================================================================

// ── Schemas ──────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────



// ── Actions ──────────────────────────────────────────────────────────────────

/**
 * ดูรายการสินค้าที่คืนได้จากบิลขาย
 * Returns items with their max returnable quantity
 */
export async function getReturnableSaleItems(saleId: string) {
  const ctx = await requirePermission('RETURN_CREATE');
  return ReturnService.getReturnableSaleItems(saleId, { userId: ctx.userId, shopId: ctx.shopId });
}

/**
 * สร้างรายการคืนสินค้า (Atomic: validate → create return → restore stock)
 */
export async function createReturn(input: CreateReturnInput): Promise<ActionResponse> {
  try {
    const ctx = await requirePermission('RETURN_CREATE');

    // 1. Validate input
    const data = createReturnSchema.parse(input);

    // 2. Call Service
    const result = await ReturnService.create(data, { userId: ctx.userId, shopId: ctx.shopId });

    revalidatePath('/sales');
    revalidatePath(`/sales/${data.saleId}`);
    revalidatePath('/returns');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: `บันทึกการคืนสินค้า ${result.returnNumber} สำเร็จ (คืนเงิน ${result.refundAmount} บาท)`,
      data: result,
    };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) return { success: false, message: error.errors[0].message };
    if (error instanceof ServiceError) return { success: false, message: error.message };
    return { success: false, message: (error as Error).message || 'เกิดข้อผิดพลาด' };
  }
}

/**
 * ดูรายการคืนสินค้าทั้งหมดของร้าน
 */
export async function getReturns(options?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const ctx = await requirePermission('RETURN_VIEW');
  return ReturnService.getList(options || {}, { userId: ctx.userId, shopId: ctx.shopId });
}

/**
 * ดูรายละเอียดการคืนสินค้า
 */
export async function getReturnById(returnId: string) {
  const ctx = await requirePermission('RETURN_VIEW');
  return ReturnService.getById(returnId, { userId: ctx.userId, shopId: ctx.shopId });
}
