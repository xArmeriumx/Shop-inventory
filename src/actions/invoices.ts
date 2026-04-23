'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { InvoiceService } from '@/services/sales/invoice.service';
import { ServiceError, type ActionResponse } from '@/types/domain';
import { serialize } from '@/lib/utils';


export async function getInvoices(params: any = {}) {
    const ctx = await requirePermission('SALE_VIEW');
    const result = await InvoiceService.list(ctx, params);
    return serialize(result);
}


export async function getInvoiceById(id: string) {
    const ctx = await requirePermission('SALE_VIEW');
    const invoice = await InvoiceService.getById(ctx, id);
    return serialize(invoice);
}


export async function createInvoiceFromSale(saleId: string): Promise<ActionResponse> {
    const ctx = await requirePermission('SALE_CREATE');
    try {
        const invoice = await InvoiceService.createFromSale(ctx, saleId);
        revalidatePath('/invoices');
        revalidatePath(`/sales/${saleId}`);
        return { success: true, message: 'สร้างใบแจ้งหนี้สำเร็จ', data: { id: invoice.id } };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message, action: error.action };
        return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
}

export async function postInvoice(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('SALE_CREATE');
    try {
        await InvoiceService.post(ctx, id);
        revalidatePath('/invoices');
        revalidatePath(`/invoices/${id}`);
        return { success: true, message: 'บันทึกใบแจ้งหนี้อย่างเป็นทางการแล้ว' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
}

export async function markInvoicePaid(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('FINANCE_VIEW_LEDGER' as any);
    try {
        await InvoiceService.markPaid(ctx, id);
        revalidatePath('/invoices');
        revalidatePath(`/invoices/${id}`);
        return { success: true, message: 'บันทึกการรับชำระเงินเรียบร้อยแล้ว' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
}

export async function cancelInvoice(id: string): Promise<ActionResponse> {
    const ctx = await requirePermission('SALE_CANCEL');
    try {
        await InvoiceService.cancel(ctx, id);
        revalidatePath('/invoices');
        revalidatePath(`/invoices/${id}`);
        return { success: true, message: 'ยกเลิกใบแจ้งหนี้เรียบร้อยแล้ว' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'เกิดข้อผิดพลาด' };
    }
}
export async function getInvoiceStats() {
    const ctx = await requirePermission('SALE_VIEW');
    const stats = await InvoiceService.getStats(ctx);
    return serialize(stats);
}
