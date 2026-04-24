'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { deliveryOrderSchema, type DeliveryOrderInput } from '@/schemas/sales/delivery.schema';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ActionResponse } from '@/types/common';

/**
 * Get delivery orders list
 */
export async function getDeliveryOrders(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VIEW');
            return DeliveryOrderService.list(ctx, params);
        }, 'sales:getDeliveryOrders');
    }, { context: { action: 'getDeliveryOrders' } });
}

/**
 * Create a new delivery order
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
        }, 'sales:createDeliveryOrder');
    }, { context: { action: 'createDeliveryOrder', saleId: input.saleId } });
}

/**
 * Validate/Confirm delivery order
 */
export async function validateDelivery(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('DELIVERY_VALIDATE');
            const result = await DeliveryOrderService.validate(ctx, id);
            revalidatePath('/deliveries');
            revalidatePath('/sales');
            return result;
        }, 'sales:validateDelivery');
    }, { context: { action: 'validateDelivery', id } });
}
