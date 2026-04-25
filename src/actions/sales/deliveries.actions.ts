'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { deliveryOrderSchema, type DeliveryOrderInput } from '@/schemas/sales/delivery.schema';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ActionResponse } from '@/types/common';

/**
 * getDeliveryOrders — รายการ DO พร้อม Filter
 */
export async function getDeliveryOrders(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VIEW');
            return DeliveryOrderService.list(ctx, params);
        }, 'delivery:getDeliveryOrders');
    }, { context: { action: 'getDeliveryOrders' } });
}

/**
 * createDeliveryOrder — สร้าง DO จาก SO
 * ⚡ Auto-sets status: PROCESSING (มีสต็อก) หรือ WAITING (สต็อกไม่พอ)
 */
export async function createDeliveryOrder(input: DeliveryOrderInput): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VALIDATE');
            const validated = deliveryOrderSchema.parse(input);
            const result = await DeliveryOrderService.create(ctx, validated);
            revalidatePath('/deliveries');
            revalidatePath(`/sales/${validated.saleId}`);
            return result;
        }, 'delivery:createDeliveryOrder');
    }, { context: { action: 'createDeliveryOrder', saleId: input.saleId } });
}

/**
 * checkDOAvailability — ตรวจสต็อกใหม่ สำหรับ DO ที่ WAITING
 *
 * ถ้าสต็อกพอแล้ว: WAITING → PROCESSING (AVAILABLE)
 * ถ้ายังไม่พอ: คืน shortages list ให้ UI แสดง
 */
export async function checkDOAvailability(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VALIDATE');
            const result = await DeliveryOrderService.checkAvailability(ctx, id);
            if (result.available) {
                revalidatePath('/deliveries');
                revalidatePath(`/deliveries/${id}`);
            }
            return result;
        }, 'delivery:checkDOAvailability');
    }, { context: { action: 'checkDOAvailability', id } });
}

/**
 * validateDelivery (= Done) — User ยืนยันจัดส่ง
 *
 * Flow: ตัดสต็อก + Auto Invoice + completeSale
 * Guard: DO ต้องอยู่ใน PROCESSING (AVAILABLE) เท่านั้น
 */
export async function validateDelivery(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VALIDATE');
            const result = await DeliveryOrderService.validate(ctx, id);
            revalidatePath('/deliveries');
            revalidatePath(`/deliveries/${id}`);
            revalidatePath('/sales');
            revalidatePath('/invoices');
            return result;
        }, 'delivery:validateDelivery');
    }, { context: { action: 'validateDelivery', id } });
}

/**
 * cancelDeliveryOrder — ยกเลิก DO (ห้ามยกเลิก DELIVERED)
 */
export async function cancelDeliveryOrder(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VALIDATE');
            await DeliveryOrderService.cancel(ctx, id);
            revalidatePath('/deliveries');
            revalidatePath(`/deliveries/${id}`);
            return null;
        }, 'delivery:cancelDeliveryOrder');
    }, { context: { action: 'cancelDeliveryOrder', id } });
}
