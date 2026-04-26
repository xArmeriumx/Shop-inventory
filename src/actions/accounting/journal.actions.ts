'use server';

import { JournalService } from '@/services/accounting/journal.service';
import { requireShop } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { getPaymentHistoryAction } from './payments.actions';
import { ActionResponse } from '@/types/common';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { requirePermission } from '@/lib/auth-guard';
import { ACCOUNTING_TAGS } from '@/config/cache-tags';
import { revalidateTag } from 'next/cache';

/**
 * ดึงรายการสมุดรายวัน
 */
export async function getJournalsAction(params: {
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await JournalService.getEntries(ctx, {
                ...params,
                startDate: params.startDate ? new Date(params.startDate) : undefined,
                endDate: params.endDate ? new Date(params.endDate) : undefined,
            });
        }, 'accounting:getJournals');
    }, { context: { action: 'getJournalsAction', params } });
}

/**
 * สร้างรายการสมุดรายวัน
 */
export async function createJournalAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG' as any);
            const result = await JournalService.createEntry(ctx, {
                ...data,
                journalDate: new Date(data.journalDate),
            });
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:createJournal');
    }, { context: { action: 'createJournalAction', data } });
}

/**
 * ยืนยันการลงรายการ (Post)
 */
export async function postJournalAction(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG' as any);
            const result = await JournalService.postEntry(id, ctx);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:postJournal');
    }, { context: { action: 'postJournalAction', id } });
}

/**
 * ยกเลิกรายการ (Void)
 */
export async function voidJournalAction(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_PAYMENT_VOID');
            const result = await JournalService.voidEntry(id, ctx);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        });
    }, { context: { action: 'voidJournalAction' } });
}

/**
 * ดึงข้อมูลพรีวิวการลงบัญชีสำหรับใบแจ้งหนี้
 */
export async function getInvoicePostingPreviewAction(invoiceId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            const invoice = await (db as any).invoice.findUnique({
                where: { id: invoiceId, shopId: ctx.shopId },
            });

            if (!invoice) throw new Error('Invoice not found');

            return await PostingService.previewInvoice(ctx, invoice);
        }, 'accounting:getInvoicePostingPreview');
    }, { context: { action: 'getInvoicePostingPreviewAction', invoiceId } });
}

/**
 * ดึงข้อมูลพรีวิวการลงบัญชีสำหรับรายการชำระเงิน
 */
export async function getPaymentPostingPreviewAction(paymentData: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await PostingService.previewPayment(ctx, paymentData);
        }, 'accounting:getPaymentPostingPreview');
    }, { context: { action: 'getPaymentPostingPreviewAction' } });
}

export async function getJournalEntryBySourceAction(sourceType: string, sourceId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await JournalService.getEntryBySource(ctx, sourceType, sourceId);
        });
    }, { context: { action: 'getJournalEntryBySourceAction' } });
}
