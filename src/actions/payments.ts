'use server';

import { PaymentService, PaymentInput } from '@/services/accounting/payment.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { Permission } from '@prisma/client';

/**
 * Record a new payment via Server Action
 */
export async function recordPaymentAction(data: PaymentInput) {
    try {
        const ctx = await requirePermission('PAYMENT_RECORD' as any);
        const result = await PaymentService.recordPayment(data, ctx);

        // Revalidate the parent document paths
        if (data.saleId) revalidatePath(`/sales/${data.saleId}`);
        if (data.invoiceId) revalidatePath(`/invoices/${data.invoiceId}`);

        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการบันทึกการชำระเงิน' };
    }
}

/**
 * Void a payment via Server Action
 */
export async function voidPaymentAction(paymentId: string, parentPaths: { saleId?: string, invoiceId?: string }) {
    try {
        const ctx = await requirePermission('PAYMENT_VOID' as any);
        const result = await PaymentService.voidPayment(paymentId, ctx);

        // Revalidate
        if (parentPaths.saleId) revalidatePath(`/sales/${parentPaths.saleId}`);
        if (parentPaths.invoiceId) revalidatePath(`/invoices/${parentPaths.invoiceId}`);

        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการยกเลิกการชำระเงิน' };
    }
}

/**
 * Get Payment History via Server Action
 */
export async function getPaymentHistoryAction(target: { invoiceId?: string, saleId?: string }) {
    try {
        const ctx = await requireShop();
        const payments = await PaymentService.getPaymentHistory(target, ctx);
        return { success: true, data: payments };
    } catch (error: any) {
        return { success: false, error: error.message || 'ไม่สามารถดึงข้อมูลย้อนหลังได้' };
    }
}
