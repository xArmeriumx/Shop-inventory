'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { orderRequestSchema, type OrderRequestInput } from '@/schemas/sales/order-request.schema';
import { OrderRequestService } from '@/services/sales/order-request.service';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';


export async function getOrderRequests(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('ORDER_REQUEST_VIEW' as any);
            return OrderRequestService.list(ctx, params);
        }, 'sales:getOrderRequests');
    }, { context: { action: 'getOrderRequests' } });
}


export async function createOrderRequest(input: OrderRequestInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('ORDER_REQUEST_CREATE' as any);
            const validated = orderRequestSchema.parse(input);
            await OrderRequestService.create(ctx, validated as any);
            revalidatePath('/order-requests');
            return null;
        }, 'sales:createOrderRequest');
    }, { context: { action: 'createOrderRequest' } });
}

export async function submitOrderRequest(id: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('ORDER_REQUEST_SUBMIT' as any);
            await OrderRequestService.submit(ctx, id);
            revalidatePath('/order-requests');
            return null;
        }, 'sales:submitOrderRequest');
    }, { context: { action: { action: 'submitOrderRequest', id } } });
}
