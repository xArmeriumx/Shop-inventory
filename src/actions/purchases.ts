'use server';

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { requirePermission } from '@/lib/auth-guard';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchase';
import { 
  PurchaseService, 
  ServiceError, 
  type GetPurchasesParams, 
  type CancelPurchaseInput,
  type SerializedPurchase 
} from '@/services';
import type { ActionResponse } from '@/types/domain';

export async function getPurchases(params: GetPurchasesParams = {}) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  return PurchaseService.getList(params, ctx);
}

// Get Purchase (ดึงข้อมูลการซื้อ)
export async function getPurchase(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  
  try {
    return await PurchaseService.getById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

// Create Purchase (สร้างการซื้อ)
export async function createPurchase(input: PurchaseInput): Promise<ActionResponse<SerializedPurchase>> {
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
    const purchase = await PurchaseService.create(ctx, validated.data);

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
      return { success: false, message: error.message, action: error.action };
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



export async function createPurchaseRequest(input: PurchaseInput): Promise<ActionResponse<{ id: string; requestNumber: string }>> {
  const ctx = await requirePermission('PURCHASE_CREATE');
  const validated = purchaseSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors, message: 'ข้อมูลใบขอซื้อไม่ถูกต้อง' };
  }

  try {
    const result = await PurchaseService.createRequest(validated.data, ctx);
    revalidatePath('/purchases');
    return { success: true, message: 'สร้างใบขอซื้อสำเร็จ', data: result };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาด',
      action: error instanceof ServiceError ? error.action : undefined
    };
  }
}

export async function approvePurchaseRequest(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_APPROVE'); // Needs this permission set up
  try {
    await PurchaseService.approveRequest(id, ctx);
    revalidatePath('/purchases');
    revalidatePath(`/purchases/${id}`);
    return { success: true, message: 'อนุมัติใบขอซื้อสำเร็จ' };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาด',
      action: error instanceof ServiceError ? error.action : undefined
    };
  }
}

export async function convertToPurchaseOrder(id: string): Promise<ActionResponse<{ id: string; poNumber: string }>> {
  const ctx = await requirePermission('PURCHASE_CREATE');
  try {
    const result = await PurchaseService.convertToPO(id, ctx);
    revalidatePath('/purchases');
    revalidatePath('/products');
    return { success: true, message: `แปลงเป็นใบสั่งซื้อสำเร็จ: ${result.poNumber}`, data: result };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาด',
      action: error instanceof ServiceError ? error.action : undefined
    };
  }
}

export async function cancelPurchase(input: CancelPurchaseInput): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_CANCEL');
  
  try {
    await PurchaseService.cancel(input, ctx);

    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    
    return { success: true, message: 'ยกเลิกรายการซื้อสำเร็จ' };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message, action: error.action };
    const typedError = error as Error;
    await logger.error('Failed to cancel purchase', typedError, { 
      path: 'cancelPurchase', 
      userId: ctx.userId,
      purchaseId: input.id,
    });
    return { success: false, message: typedError.message || 'เกิดข้อผิดพลาดในการยกเลิกรายการ' };
  }
}
