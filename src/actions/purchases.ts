'use server';

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { requireAuth, requirePermission, getCurrentUserId } from '@/lib/auth-guard';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchase';
import type { Purchase } from '@prisma/client';
export type { GetPurchasesParams, CancelPurchaseInput } from '@/services';
import { PurchaseService, ServiceError, type GetPurchasesParams, type CancelPurchaseInput } from '@/services';
import type { ActionResponse } from '@/types/action-response';

export async function getPurchases(params: GetPurchasesParams = {}) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  return PurchaseService.getList(params, { userId: ctx.userId, shopId: ctx.shopId });
}

// Get Purchase (ดึงข้อมูลการซื้อ)
export async function getPurchase(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  
  try {
    return await PurchaseService.getById(id, { userId: ctx.userId, shopId: ctx.shopId });
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

// Create Purchase (สร้างการซื้อ)
export async function createPurchase(input: PurchaseInput): Promise<ActionResponse<Purchase>> {
  // RBAC: Require PURCHASE_CREATE permission
  const ctx = await requirePermission('PURCHASE_CREATE');

  const validated = purchaseSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการสั่งซื้อไม่ถูกต้อง',
    };
  }

  const { items, ...purchaseData } = validated.data;
  if (items.length === 0) {
    return {
      success: false,
      message: 'ต้องมีสินค้าอย่างน้อย 1 รายการ',
    };
  }

  // 1. Create Purchase & PurchaseItems
  // 2. Loop update Stock & Cost Price

  try {
    const purchase = await PurchaseService.create({ userId: ctx.userId, shopId: ctx.shopId }, validated.data);

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    
    return {
      success: true,
      message: 'บันทึกการสั่งซื้อสำเร็จ',
      data: purchase,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) {
      return { success: false, message: error.message };
    }
    const typedError = error as Error;
    await logger.error('Failed to create purchase', typedError, { 
      path: 'createPurchase', 
      userId: ctx.userId,
      input 
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการบันทึกการสั่งซื้อ',
    };
  }
}



export async function cancelPurchase(input: CancelPurchaseInput): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_CANCEL');
  
  try {
    await PurchaseService.cancel(input, { 
      userId: ctx.userId, 
      shopId: ctx.shopId, 
    });

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    
    return { success: true, message: 'ยกเลิกรายการซื้อสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to cancel purchase', typedError, { 
      path: 'cancelPurchase', 
      userId: ctx.userId,
      purchaseId: input.id,
    });
    return { success: false, message: typedError.message || 'เกิดข้อผิดพลาดในการยกเลิกรายการ' };
  }
}
