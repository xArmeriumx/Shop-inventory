'use server';

import { PaymentService, PaymentInput } from '@/services/accounting/payment.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { Permission } from '@prisma/client';
import { ActionResponse } from '@/types/common';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

/**
 * Record a new payment via Server Action
 */
export async function recordPaymentAction(data: PaymentInput): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await PaymentService.recordPayment(data, ctx);

            // Revalidate the parent document paths
            if (data.saleId) revalidatePath(`/sales/${data.saleId}`);
            if (data.invoiceId) revalidatePath(`/invoices/${data.invoiceId}`);

            return result;
        });
    }, { context: { action: 'recordPaymentAction' } });
}

/**
 * Void a payment via Server Action
 */
export async function voidPaymentAction(paymentId: string, parentPaths: { saleId?: string, invoiceId?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_PAYMENT_VOID');
            const result = await PaymentService.voidPayment(paymentId, ctx);

            // Revalidate
            if (parentPaths.saleId) revalidatePath(`/sales/${parentPaths.saleId}`);
            if (parentPaths.invoiceId) revalidatePath(`/invoices/${parentPaths.invoiceId}`);

            return result;
        });
    }, { context: { action: 'voidPaymentAction' } });
}

/**
 * Get Payment History via Server Action
 */
export async function getPaymentHistoryAction(target: { invoiceId?: string, saleId?: string }): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            return await PaymentService.getPaymentHistory(target, ctx);
        });
    }, { context: { action: 'getPaymentHistoryAction' } });
}
