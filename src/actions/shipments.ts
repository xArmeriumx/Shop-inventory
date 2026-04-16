'use server';

import { revalidatePath } from 'next/cache';
import { shipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from '@/schemas/shipment';
import type { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/shipment';
import type { ActionResponse } from '@/types/domain';
export type { OcrParcel, ParcelMatch } from '@/services';
import { ShipmentService, type OcrParcel, type ParcelMatch, ServiceError } from '@/services';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

// =============================================================================
// STATUS TRANSITION VALIDATION
export async function getShipments(params: any = {}) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getList(params, ctx);
}

export async function getShipment(id: string) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  try {
    return await ShipmentService.getById(id, ctx);
  } catch (error: unknown) {
    if (error instanceof ServiceError) throw new Error(error.message);
    throw error;
  }
}

// =============================================================================
export async function getSalesWithoutShipment() {
  const ctx = await requirePermission('SHIPMENT_CREATE');
  return ShipmentService.getSalesWithoutShipment(ctx);
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
    const result = await ShipmentService.create(validated.data, ctx);

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
    if (error instanceof ServiceError) return { success: false, message: error.message, action: error.action };
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
    await ShipmentService.update(validated.data, ctx);

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
    // Calling the sync version to ensure stock deduction on SHIPPED
    await ShipmentService.updateStatusWithSync(validated.data.id, validated.data.status as any, ctx);

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${validated.data.id}`);
    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/dashboard');
    return {
      success: true,
      message: 'บันทึกความคืบหน้าสำเร็จ',
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
    await ShipmentService.cancel(id, reason, ctx);

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
  return ShipmentService.matchParcelsToSales(parcels, ctx);
}

// =============================================================================
export async function calculateShipmentLoad(id: string): Promise<ActionResponse<any>> {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  try {
    const result = await ShipmentService.calculateLoad(id, ctx);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, message: error.message || 'เกิดข้อผิดพลาด' };
  }
}

export async function processShipmentRoute(ids: string[], type: 'OUTBOUND' | 'INBOUND'): Promise<ActionResponse<any>> {
  const ctx = await requirePermission('SHIPMENT_EDIT');
  try {
    const result = await ShipmentService.processRoute(ids, type, ctx);
    revalidatePath('/shipments');
    return { success: true, message: 'จัดลำดับเส้นทางสำเร็จ', data: result };
  } catch (error: any) {
    return { 
      success: false, 
      message: error.message || 'เกิดข้อผิดพลาด',
      action: error instanceof ServiceError ? error.action : undefined
    };
  }
}

export async function getShipmentStats() {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getStats(ctx);
}
