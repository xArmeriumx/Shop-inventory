'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { deliveryOrderSchema, type DeliveryOrderInput } from '@/schemas/sales/delivery.schema';
import { DeliveryOrderService } from '@/services/inventory/delivery-order.service';
import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';

export async function getDeliveryOrders(params: any = {}) {
    const ctx = await requirePermission('DELIVERY_VIEW');
    return DeliveryOrderService.list(ctx, params);
}

export async function createDeliveryOrder(input: DeliveryOrderInput): Promise<ActionResponse> {
    const ctx = await requirePermission('DELIVERY_VALIDATE');

    const validated = deliveryOrderSchema.safeParse(input);
    if (!validated.success) return { success: false, message: 'ข้อมูลไม่ถูกต้อง' };

    try {
        await DeliveryOrderService.create(ctx, validated.data);
        revalidatePath('/deliveries');
        revalidatePath(`/sales/${validated.data.saleId}`);
        return { success: true, message: 'สร้างใบส่งของสำเร็จ' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างใบส่งของ' };
    }
}

export async function validateDelivery(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('DELIVERY_VALIDATE');

    try {
        await DeliveryOrderService.validate(ctx, id);
        revalidatePath('/deliveries');
        revalidatePath('/sales');
        return { success: true, message: 'ยืนยันการส่งของเรียบร้อยแล้ว' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการยืนยันการส่งของ' };
    }
}
