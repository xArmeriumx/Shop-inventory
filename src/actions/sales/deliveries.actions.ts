'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { deliveryOrderSchema, type DeliveryOrderInput } from '@/schemas/sales/delivery.schema';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { type ActionResponse } from '@/types/domain';

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

export async function getDeliveryOrderById(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VIEW');
            return DeliveryOrderService.getById(ctx, id);
        }, 'delivery:getDeliveryOrderById');
    }, { context: { action: 'getDeliveryOrderById', id } });
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
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
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
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
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
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
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
            const result = await DeliveryOrderService.cancel(ctx, id);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'delivery:cancelDeliveryOrder');
    }, { context: { action: 'cancelDeliveryOrder', id } });
}
