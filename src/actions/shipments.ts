'use server';

import { revalidatePath } from 'next/cache';
import { shipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from '@/schemas/shipment';
import type { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/shipment';
import { ActionResponse } from '@/types/domain';
import { handleActionError } from '@/lib/error-handler';
import { requirePermission } from '@/lib/auth-guard';
import {
  ShipmentService,
  type OcrParcel,
  type ParcelMatch,
  ServiceError
} from '@/services';

export type { OcrParcel, ParcelMatch };

// =============================================================================
// SHIPMENT LIST & DETAIL
// =============================================================================

export async function getShipments(params: any = {}) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getList(params, ctx);
}

export async function getShipment(id: string) {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getById(id, ctx);
}

export async function getSalesWithoutShipment() {
  const ctx = await requirePermission('SHIPMENT_CREATE');
  return ShipmentService.getSalesWithoutShipment(ctx);
}

// =============================================================================
// SHIPMENT OPERATIONS
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
    return { success: true, message: 'สร้างรายการจัดส่งสำเร็จ', data: result };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการสร้างรายการจัดส่ง', { path: 'createShipment', userId: ctx.userId });
  }
}

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
    return { success: true, message: 'อัพเดทข้อมูลจัดส่งสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการอัปเดตข้อมูลจัดส่ง', { path: 'updateShipment', userId: ctx.userId, shipmentId: validated.data.id });
  }
}

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
    return { success: true, message: 'บันทึกความคืบหน้าสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะรายการจัดส่ง', { path: 'updateShipmentStatus', userId: ctx.userId, shipmentId: validated.data.id });
  }
}

export async function cancelShipment(id: string, reason?: string): Promise<ActionResponse> {
  const ctx = await requirePermission('SHIPMENT_CANCEL');

  try {
    await ShipmentService.cancel(id, reason, ctx);
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    return { success: true, message: 'ยกเลิกรายการจัดส่งสำเร็จ' };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการยกเลิกรายการจัดส่ง', { path: 'cancelShipment', userId: ctx.userId, shipmentId: id });
  }
}

// =============================================================================
// LOGISTICS INTELLIGENCE
// =============================================================================

export async function matchParcelsToSales(parcels: OcrParcel[]): Promise<ParcelMatch[]> {
  const ctx = await requirePermission('SHIPMENT_CREATE');
  return ShipmentService.matchParcelsToSales(parcels, ctx);
}

export async function calculateShipmentLoad(id: string): Promise<ActionResponse<any>> {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  try {
    const result = await ShipmentService.calculateLoad(id, ctx);
    return { success: true, data: result };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการคำนวณภาระบรรทุก', { path: 'calculateShipmentLoad', userId: ctx.userId, shipmentId: id });
  }
}

export async function processShipmentRoute(ids: string[], type: 'OUTBOUND' | 'INBOUND'): Promise<ActionResponse<any>> {
  const ctx = await requirePermission('SHIPMENT_EDIT');
  try {
    const result = await ShipmentService.processRoute(ids, type, ctx);
    revalidatePath('/shipments');
    return { success: true, message: 'จัดลำดับเส้นทางสำเร็จ', data: result };
  } catch (error: unknown) {
    return handleActionError(error, 'เกิดข้อผิดพลาดในการจัดเส้นทาง', { path: 'processShipmentRoute', userId: ctx.userId });
  }
}

export async function getShipmentStats() {
  const ctx = await requirePermission('SHIPMENT_VIEW');
  return ShipmentService.getStats(ctx);
}
