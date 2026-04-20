'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { quotationSchema, type QuotationInput } from '@/schemas/quotation';
import { QuotationService } from '@/services/quotation.service';
import { ServiceError } from '@/types/domain';
import type { ActionResponse } from '@/types/domain';

export async function getQuotations(params: any = {}) {
    const ctx = await requirePermission('QUOTATION_VIEW');
    return QuotationService.list(ctx, params);
}

export async function createQuotation(input: QuotationInput): Promise<ActionResponse> {
    const ctx = await requirePermission('QUOTATION_CREATE');

    const validated = quotationSchema.safeParse(input);
    if (!validated.success) {
        return {
            success: false,
            errors: validated.error.flatten().fieldErrors,
            message: 'ข้อมูลไม่ถูกต้อง',
        };
    }

    try {
        await QuotationService.create(ctx, validated.data);
        revalidatePath('/quotations');
        return {
            success: true,
            message: 'สร้างใบเสนอราคาสำเร็จ',
        };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        await logger.error('Create Quotation Error', error, { userId: ctx.userId });
        return { success: false, message: 'เกิดข้อผิดพลาดในการสร้างใบเสนอราคา' };
    }
}

export async function confirmQuotation(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('QUOTATION_CONFIRM');

    try {
        await QuotationService.confirm(ctx, id);
        revalidatePath('/quotations');
        revalidatePath('/sales');
        return {
            success: true,
            message: 'ยืนยันใบเสนอราคาและสร้างรายการขายสำเร็จ',
        };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการยืนยันใบเสนอราคา' };
    }
}

export async function cancelQuotation(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('QUOTATION_EDIT');

    try {
        await QuotationService.cancel(ctx, id);
        revalidatePath('/quotations');
        return {
            success: true,
            message: 'ยกเลิกใบเสนอราคาสำเร็จ',
        };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาดในการยกเลิกใบเสนอราคา' };
    }
}
