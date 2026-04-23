'use server';

import { ActionResponse, ServiceError } from '@/types/domain';
import { requirePermission } from '@/lib/auth-guard';
import { VoucherService } from '@/services/accounting/voucher.service';
import { receiptVoucherSchema, paymentVoucherSchema, ReceiptVoucherInput, PaymentVoucherInput } from '@/schemas/voucher';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { serialize } from '@/lib/utils';

/**
 * บันทึกใบสำคัญรับเงิน (Receipt Voucher)
 */
export async function createReceiptVoucherAction(data: ReceiptVoucherInput): Promise<ActionResponse> {
    const ctx = await requirePermission('INVOICE_UPDATE' as any);
    try {
        // 1. Validation
        const validated = receiptVoucherSchema.parse(data);

        // 2. Execution
        await VoucherService.createReceiptVoucher(ctx, validated);

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/ledgers');
        revalidatePath('/invoices');

        return { success: true, message: 'บันทึกการรับชำระเงินสำเร็จ' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'บันทึกไม่สำเร็จ', errors: error.message };
    }
}

/**
 * บันทึกใบสำคัญจ่ายเงิน (Payment Voucher)
 */
export async function createPaymentVoucherAction(data: PaymentVoucherInput): Promise<ActionResponse> {
    const ctx = await requirePermission('PURCHASE_UPDATE' as any);
    try {
        // 1. Validation
        const validated = paymentVoucherSchema.parse(data);

        // 2. Execution
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

        return { success: true, message: 'บันทึกการจ่ายเงินสำเร็จ' };
    } catch (error: any) {
        if (error instanceof ServiceError) return { success: false, message: error.message };
        return { success: false, message: 'บันทึกไม่สำเร็จ', errors: error.message };
    }
}

/**
 * ดึงรายการเอกสารที่ยังค้างชำระ (Unpaid/Partial)
 */
export async function getUnpaidDocumentsAction(params: {
    type: 'RECEIPT' | 'PAYMENT',
    partnerId: string
}): Promise<ActionResponse<any[]>> {
    const ctx = await requirePermission(params.type === 'RECEIPT' ? 'SALE_VIEW' : 'PURCHASE_VIEW');
    try {
        const { type, partnerId } = params;

        if (!partnerId) return { success: true, data: [] };

        const where: any = {
            shopId: ctx.shopId,
            status: type === 'RECEIPT' ? 'POSTED' : 'RECEIVED', // Must be confirmed docs
            paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
            ...(type === 'RECEIPT' ? { customerId: partnerId } : { supplierId: partnerId })
        };

        const docs = type === 'RECEIPT'
            ? await (db as any).invoice.findMany({ where, orderBy: { date: 'asc' } })
            : await (db as any).purchase.findMany({ where, orderBy: { date: 'asc' } });

        const mappedData = docs.map((d: any) => ({
            id: d.id,
            docNo: d.invoiceNo || d.purchaseNumber,
            date: d.date,
            totalAmount: Number(d.totalAmount),
            residualAmount: Number(d.residualAmount),
            paidAmount: Number(d.paidAmount),
        }));

        return { success: true, data: serialize(mappedData) };
    } catch (error: any) {
        return { success: false, message: 'ดึงข้อมูลไม่สำเร็จ', errors: error.message };
    }
}
