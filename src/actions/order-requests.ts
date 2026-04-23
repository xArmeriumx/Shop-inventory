'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { orderRequestSchema, type OrderRequestInput } from '@/schemas/order-request';
import { OrderRequestService } from '@/services/sales/order-request.service';
import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';
import { serialize } from '@/lib/utils';


export async function getOrderRequests(params: any = {}) {
    const ctx = await requirePermission('ORDER_REQUEST_VIEW' as any);

    const result = await OrderRequestService.list(ctx, params);
    return serialize(result);
}


export async function createOrderRequest(input: OrderRequestInput): Promise<ActionResponse> {
    const ctx = await requirePermission('ORDER_REQUEST_CREATE' as any);


    const validated = orderRequestSchema.safeParse(input);
    if (!validated.success) {
        return {
            success: false,
            errors: validated.error.flatten().fieldErrors,
            message: 'ข้อมูลไม่ถูกต้อง',
        };
    }

    try {
        await OrderRequestService.create(ctx, validated.data as any);
        revalidatePath('/order-requests');
        return {
            success: true,
            message: 'สร้างคำขอซื้อสำเร็จ',
        };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        await logger.error('Create Order Request Error', error, { userId: ctx.userId });
        return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างคำขอซื้อ' };
    }
}

export async function submitOrderRequest(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('ORDER_REQUEST_SUBMIT' as any);


    try {
        await OrderRequestService.submit(ctx, id);
        revalidatePath('/order-requests');
        return {
            success: true,
            message: 'ส่งคำขอซื้อเพื่อดำเนินการต่อสำเร็จ',
        };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการส่งคำขอซื้อ' };
    }
}
