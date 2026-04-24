'use server';

import { revalidatePath } from 'next/cache';
import { shipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from '@/schemas/sales/shipment.schema';
import type { ShipmentInput, UpdateShipmentInput, UpdateShipmentStatusInput } from '@/schemas/sales/shipment.schema';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
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

// =============================================================================
// SHIPMENT LIST & DETAIL
// =============================================================================

export async function getShipments(params: any = {}): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_VIEW');
    return ShipmentService.getList(params, ctx);
  }, { context: { action: 'getShipments' } });
}

export async function getShipment(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_VIEW');
    return ShipmentService.getById(id, ctx);
  }, { context: { action: 'getShipment', id } });
}

export async function getSalesWithoutShipment(): Promise<ActionResponse<any[]>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_CREATE');
    return ShipmentService.getSalesWithoutShipment(ctx);
  }, { context: { action: 'getSalesWithoutShipment' } });
}

// =============================================================================
// SHIPMENT OPERATIONS
// =============================================================================

export async function createShipment(input: ShipmentInput): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_CREATE');
    const validated = shipmentSchema.parse(input);
    const result = await ShipmentService.create(validated, ctx);

    revalidatePath('/shipments');
    revalidatePath('/sales');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');

    return result;
  }, { context: { action: 'createShipment' } });
}

export async function updateShipment(input: UpdateShipmentInput): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_EDIT');
    const validated = updateShipmentSchema.parse(input);

    await ShipmentService.update(validated, ctx);

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${validated.id}`);

    return null;
  }, { context: { action: 'updateShipment', shipmentId: input.id } });
}

export async function updateShipmentStatus(input: UpdateShipmentStatusInput): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_EDIT');
    const validated = updateShipmentStatusSchema.parse(input);

    // Calling the sync version to ensure stock deduction on SHIPPED
    await ShipmentService.updateStatusWithSync(validated.id, validated.status as any, ctx);

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${validated.id}`);
    revalidatePath('/sales');
    revalidatePath('/products');
    revalidatePath('/dashboard');

    return null;
  }, { context: { action: 'updateShipmentStatus', shipmentId: input.id } });
}

export async function cancelShipment(id: string, reason?: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_CANCEL');
    await ShipmentService.cancel(id, reason, ctx);

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);

    return null;
  }, { context: { action: 'cancelShipment', shipmentId: id } });
}

// =============================================================================
// LOGISTICS INTELLIGENCE
// =============================================================================

export async function matchParcelsToSales(parcels: OcrParcel[]): Promise<ActionResponse<ParcelMatch[]>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_CREATE');
    return ShipmentService.matchParcelsToSales(parcels, ctx);
  }, { context: { action: 'matchParcelsToSales' } });
}

export async function calculateShipmentLoad(id: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_VIEW');
    return ShipmentService.calculateLoad(id, ctx);
  }, { context: { action: 'calculateShipmentLoad', shipmentId: id } });
}

export async function processShipmentRoute(ids: string[], type: 'OUTBOUND' | 'INBOUND'): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_EDIT');
    const result = await ShipmentService.processRoute(ids, type, ctx);
    revalidatePath('/shipments');
    return result;
  }, { context: { action: 'processShipmentRoute' } });
}

export async function getShipmentStats(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    const ctx = await requirePermission('SHIPMENT_VIEW');
    return ShipmentService.getStats(ctx);
  }, { context: { action: 'getShipmentStats' } });
}
