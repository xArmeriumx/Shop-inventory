'use server';

import { PaymentService, PaymentInput } from '@/services/accounting/payment.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidateTag } from 'next/cache';
import { ActionResponse } from '@/types/common';
import { SALES_TAGS, INVOICE_TAGS, ACCOUNTING_TAGS } from '@/config/cache-tags';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

/**
 * Record a new payment via Server Action
 * Fix #3: Use revalidateTag (SSOT pattern) instead of revalidatePath
 */
export async function recordPaymentAction(data: PaymentInput): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await PaymentService.recordPayment(data, ctx);

            // Invalidate: sale/invoice detail + dashboard stats
            if (data.saleId) revalidateTag(SALES_TAGS.DETAIL(data.saleId));
            if (data.invoiceId) revalidateTag(INVOICE_TAGS.DETAIL(data.invoiceId));
            revalidateTag(SALES_TAGS.DASHBOARD);
            revalidateTag(INVOICE_TAGS.STATS);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);

            return result;
        }, 'accounting:recordPayment');
    }, { context: { action: 'recordPaymentAction' } });
}

/**
 * Void a payment via Server Action
 * Fix #3: Use revalidateTag (SSOT pattern) instead of revalidatePath
 */
export async function voidPaymentAction(paymentId: string, parentPaths: { saleId?: string, invoiceId?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_PAYMENT_VOID');
            const result = await PaymentService.voidPayment(paymentId, ctx);

            // Invalidate affected documents
            if (parentPaths.saleId) revalidateTag(SALES_TAGS.DETAIL(parentPaths.saleId));
            if (parentPaths.invoiceId) revalidateTag(INVOICE_TAGS.DETAIL(parentPaths.invoiceId));
            revalidateTag(SALES_TAGS.DASHBOARD);
            revalidateTag(INVOICE_TAGS.STATS);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);

            return result;
        }, 'accounting:voidPayment');
    }, { context: { action: 'voidPaymentAction', paymentId } });
}

/**
 * Get Payment History via Server Action
 */
export async function getPaymentHistoryAction(target: { invoiceId?: string, saleId?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return await PaymentService.getPaymentHistory(target, ctx);
        }, 'accounting:getPaymentHistory');
    }, { context: { action: 'getPaymentHistoryAction' } });
}
