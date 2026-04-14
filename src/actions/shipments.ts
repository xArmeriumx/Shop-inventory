'use server';

import { revalidatePath } from 'next/cache';
import { shipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from '@/schemas/shipment';
import type { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/shipment';
import type { ActionResponse } from '@/types/action-response';
import { ShipmentService, OcrParcel, ParcelMatch, ServiceError } from '@/services';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

// =============================================================================
// STATUS TRANSITION VALIDATION
export async function getShipments(params: any = {}) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getList(params, { userId: ctx.userId, shopId: ctx.shopId });
}

export async function getShipment(id: string) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  try {
    return await ShipmentService.getById(id, { userId: ctx.userId, shopId: ctx.shopId });
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

// =============================================================================
export async function getSalesWithoutShipment() {
  const ctx = await requirePermission('SHIPMENT_CREATE');
  return ShipmentService.getSalesWithoutShipment({ userId: ctx.userId, shopId: ctx.shopId });
}

// =============================================================================
export async function createShipment(input: ShipmentInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_CREATE');

  const validated = shipmentSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลการจัดส่งไม่ถูกต้อง',
    };
  }

  try {
    const result = await ShipmentService.create(validated.data, { userId: ctx.userId, shopId: ctx.shopId });

    revalidatePath('/shipments');
    revalidatePath('/sales');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: 'สร้างรายการจัดส่งสำเร็จ',
      data: result,
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to create shipment', typedError, {
      path: 'createShipment',
      userId: ctx.userId,
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการสร้างรายการจัดส่ง',
    };
  }
}

// =============================================================================
export async function updateShipment(input: UpdateShipmentInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_EDIT');

  const validated = updateShipmentSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  try {
    await ShipmentService.update(validated.data, { userId: ctx.userId, shopId: ctx.shopId });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${validated.data.id}`);
    return {
      success: true,
      message: 'อัพเดทข้อมูลจัดส่งสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to update shipment', typedError, {
      path: 'updateShipment',
      userId: ctx.userId,
      shipmentId: validated.data.id,
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// =============================================================================
export async function updateShipmentStatus(input: UpdateShipmentStatusInput): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_EDIT');

  const validated = updateShipmentStatusSchema.safeParse(input);
  if (!validated.success) {
    return {
      success: false,
      message: 'ข้อมูลไม่ถูกต้อง',
    };
  }

  try {
    await ShipmentService.updateStatus(validated.data, { userId: ctx.userId, shopId: ctx.shopId });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${validated.data.id}`);
    revalidatePath('/dashboard');
    return {
      success: true,
      message: 'เปลี่ยนสถานะเป็นสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to update shipment status', typedError, {
      path: 'updateShipmentStatus',
      userId: ctx.userId,
      shipmentId: validated.data.id,
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาด',
    };
  }
}

// =============================================================================
export async function cancelShipment(
  id: string,
  reason?: string
): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_CANCEL');

  try {
    await ShipmentService.cancel(id, reason, { userId: ctx.userId, shopId: ctx.shopId });

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    return {
      success: true,
      message: 'ยกเลิกรายการจัดส่งสำเร็จ',
    };
  } catch (error: unknown) {
    if (error instanceof ServiceError) return { success: false, message: error.message };
    const typedError = error as Error;
    await logger.error('Failed to cancel shipment', typedError, {
      path: 'cancelShipment',
      userId: ctx.userId,
      shipmentId: id,
    });
    return {
      success: false,
      message: typedError.message || 'เกิดข้อผิดพลาดในการยกเลิก',
    };
  }
}

// =============================================================================
// OCR Match interface export removed since they are moved to services.

export async function matchParcelsToSales(parcels: OcrParcel[]): Promise<ParcelMatch[]> {
  const ctx = await requirePermission('SHIPMENT_CREATE');
  return ShipmentService.matchParcelsToSales(parcels, { userId: ctx.userId, shopId: ctx.shopId });
}

// =============================================================================
export async function getShipmentStats() {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getStats({ userId: ctx.userId, shopId: ctx.shopId });
}
