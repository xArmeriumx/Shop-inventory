'use server';

import { requirePermission } from '@/lib/auth-guard';
import { VoucherService } from '@/services/accounting/voucher.service';
import { receiptVoucherSchema, paymentVoucherSchema, ReceiptVoucherInput, PaymentVoucherInput } from '@/schemas/accounting/voucher.schema';
import { revalidateTag } from 'next/cache';
import { serialize } from '@/lib/utils';
import { handleAction, type ActionResponse } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ACCOUNTING_TAGS, INVOICE_TAGS, PURCHASE_TAGS } from '@/config/cache-tags';

/** บันทึกใบสำคัญรับเงิน (Receipt Voucher) */
export async function createReceiptVoucherAction(data: ReceiptVoucherInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('INVOICE_MANAGE');
            const validated = receiptVoucherSchema.parse(data);
            await VoucherService.createReceiptVoucher(ctx, validated);

            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            revalidateTag(INVOICE_TAGS.LIST);
            revalidateTag(INVOICE_TAGS.STATS);
            return null;
        }, 'accounting:createReceiptVoucher');
    }, { context: { action: 'createReceiptVoucher' } });
}

/** บันทึกใบสำคัญจ่ายเงิน (Payment Voucher) */
export async function createPaymentVoucherAction(data: PaymentVoucherInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('PURCHASE_UPDATE');
            const validated = paymentVoucherSchema.parse(data);

            await VoucherService.createPaymentVoucher(ctx, {
                ...validated,
                allocations: validated.allocations.map(a => ({
                    purchaseId: a.purchaseId,
                    amount: a.amount,
                })),
            });

            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            revalidateTag(PURCHASE_TAGS.LIST);
            return null;
        }, 'accounting:createPaymentVoucher');
    }, { context: { action: 'createPaymentVoucher' } });
}

/** ดึงรายการเอกสารที่ยังค้างชำระ (Unpaid/Partial) — delegates to VoucherService (SSOT) */
export async function getUnpaidDocumentsAction(params: {
    type: 'RECEIPT' | 'PAYMENT';
    partnerId: string;
}): Promise<ActionResponse<any[]>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission(params.type === 'RECEIPT' ? 'SALE_VIEW' : 'PURCHASE_VIEW');
            const docs = await VoucherService.getUnpaidDocuments(ctx, params);
            return serialize(docs);
        }, 'accounting:getUnpaidDocuments');
    }, { context: { action: 'getUnpaidDocuments', partnerId: params.partnerId } });
}
