'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { purchaseSchema, type PurchaseInput } from '@/schemas/purchases/purchase.schema';
import { handleActionError } from '@/lib/error-handler';
import {
  PurchaseService,
  type GetPurchasesParams,
  type CancelPurchaseInput,
} from '@/services';
import { serialize } from '@/lib/utils';
import type { ActionResponse } from '@/types/domain';
import { SerializedPurchase } from '@/types/serialized';


// =============================================================================
// PURCHASE LIST & DETAIL
// =============================================================================

export async function getPurchases(params: GetPurchasesParams = {}) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  const result = await PurchaseService.getList(params, ctx);
  return serialize(result);
}


export async function getPurchase(id: string) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  const result = await PurchaseService.getById(id, ctx);
  return serialize(result);
}


// =============================================================================
// PURCHASE OPERATIONS
// =============================================================================

export async function createPurchase(input: PurchaseInput): Promise<ActionResponse<SerializedPurchase>> {
  const ctx = await requirePermission('PURCHASE_CREATE');

  const validated = purchaseSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการสั่งซื้อไม่ถูกต้อง',
    };
  }

  try {
    const purchase = await PurchaseService.create(ctx, validated.data);
    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return serialize({ success: true, message: 'บันทึกการสั่งซื้อสำเร็จ', data: purchase });
  } catch (error: unknown) {

    return handleActionError(error, 'เกิดข้อผิดพลาดในการบันทึกการสั่งซื้อ', { path: 'createPurchase', userId: ctx.userId });
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
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการสร้างใบขอซื้อ', { path: 'createPurchaseRequest', userId: ctx.userId });
  }
}

export async function approvePurchaseRequest(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('APPROVAL_ACTION');
  try {
    await PurchaseService.approveRequest(id, ctx);
    revalidatePath('/purchases');
    revalidatePath(`/purchases/${id}`);
    return { success: true, message: 'อนุมัติใบขอซื้อสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการอนุมัติใบขอซื้อ', { path: 'approvePurchaseRequest', userId: ctx.userId, prId: id });
  }
}

export async function convertToPurchaseOrder(id: string): Promise<ActionResponse<{ id: string; poNumber: string }>> {
  const ctx = await requirePermission('PURCHASE_CREATE');
  try {
    const result = await PurchaseService.convertToPO(id, ctx);
    revalidatePath('/purchases');
    revalidatePath('/products');
    return { success: true, message: `แปลงเป็นใบสั่งซื้อสำเร็จ: ${result.poNumber}`, data: result };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการแปลงเป็นใบสั่งซื้อ', { path: 'convertToPurchaseOrder', userId: ctx.userId, prId: id });
  }
}

export async function cancelPurchase(input: CancelPurchaseInput): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_VOID');
  try {
    await PurchaseService.cancel(input, ctx);
    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true, message: 'ยกเลิกรายการซื้อสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการยกเลิกรายการซื้อ', { path: 'cancelPurchase', userId: ctx.userId, purchaseId: input.id });
  }
}

export async function receivePurchase(id: string): Promise<ActionResponse> {
  const ctx = await requirePermission('PURCHASE_CREATE');
  try {
    await PurchaseService.receivePurchase(id, ctx);
    revalidatePath('/purchases');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return { success: true, message: 'รับสินค้าเข้าคลังสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการรับสินค้า', { path: 'receivePurchase', userId: ctx.userId, purchaseId: id });
  }
}
