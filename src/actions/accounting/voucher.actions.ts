'use server';

import { requirePermission } from '@/lib/auth-guard';
import { VoucherService } from '@/services/accounting/voucher.service';
import { receiptVoucherSchema, paymentVoucherSchema, ReceiptVoucherInput, PaymentVoucherInput } from '@/schemas/accounting/voucher.schema';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { serialize } from '@/lib/utils';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { ServiceError } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';

/**
 * บันทึกใบสำคัญรับเงิน (Receipt Voucher)
 */
export async function createReceiptVoucherAction(data: ReceiptVoucherInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('INVOICE_MANAGE');
            const validated = receiptVoucherSchema.parse(data);
            await VoucherService.createReceiptVoucher(ctx, validated);

            revalidatePath('/accounting/receipts');
            revalidatePath('/accounting/ledgers');
            revalidatePath('/invoices');
            return null;
        }, 'accounting:createReceiptVoucher');
    }, { context: { action: 'createReceiptVoucher' } });
}

/**
 * บันทึกใบสำคัญจ่ายเงิน (Payment Voucher)
 */
export async function createPaymentVoucherAction(data: PaymentVoucherInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('PURCHASE_UPDATE');
            const validated = paymentVoucherSchema.parse(data);

            await VoucherService.createPaymentVoucher(ctx, {
                ...validated,
                allocations: validated.allocations.map(a => ({
                    purchaseId: a.purchaseId,
                    amount: a.amount
                }))
            });

            revalidatePath('/accounting/payments');
            revalidatePath('/accounting/ledgers');
            revalidatePath('/purchases');
            return null;
        }, 'accounting:createPaymentVoucher');
    }, { context: { action: 'createPaymentVoucher' } });
}

/**
 * ดึงรายการเอกสารที่ยังค้างชำระ (Unpaid/Partial)
 */
export async function getUnpaidDocumentsAction(params: {
    type: 'RECEIPT' | 'PAYMENT',
    partnerId: string
}): Promise<ActionResponse<any[]>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission(params.type === 'RECEIPT' ? 'SALE_VIEW' : 'PURCHASE_VIEW');
            const { type, partnerId } = params;

            if (!partnerId) return [];

            const where: any = {
                shopId: ctx.shopId,
                status: type === 'RECEIPT' ? 'POSTED' : 'RECEIVED',
                paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
                ...(type === 'RECEIPT' ? { customerId: partnerId } : { supplierId: partnerId })
            };

            const docs = type === 'RECEIPT'
                ? await db.invoice.findMany({ where, orderBy: { date: 'asc' } })
                : await db.purchase.findMany({ where, orderBy: { date: 'asc' } });

            const mappedData = docs.map((d: any) => ({
                id: d.id,
                docNo: d.invoiceNo || d.purchaseNumber,
                date: d.date,
                totalAmount: Number(d.totalAmount),
                residualAmount: Number(d.residualAmount),
                paidAmount: Number(d.paidAmount),
            }));

            return serialize(mappedData);
        }, 'accounting:getUnpaidDocuments');
    }, { context: { action: 'getUnpaidDocuments', partnerId: params.partnerId } });
}
