'use server';

import { JournalService } from '@/services/accounting/journal.service';
import { requirePermission } from '@/lib/auth-guard';
import { PostingService } from '@/services/accounting/posting-engine.service';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { ACCOUNTING_TAGS } from '@/config/cache-tags';
import { revalidateTag } from 'next/cache';
import { InvoiceService } from '@/services/sales/invoice.service';

/** ดึงรายการสมุดรายวัน */
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

/** สร้างรายการสมุดรายวัน */
export async function createJournalAction(data: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await JournalService.createEntry(ctx, {
                ...data,
                journalDate: new Date(data.journalDate),
            });
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:createJournal');
    }, { context: { action: 'createJournalAction', data } });
}

/** ยืนยันการลงรายการ (Post) */
export async function postJournalAction(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_CONFIG');
            const result = await JournalService.postEntry(id, ctx);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:postJournal');
    }, { context: { action: 'postJournalAction', id } });
}

/** ยกเลิกรายการ (Void) */
export async function voidJournalAction(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_PAYMENT_VOID');
            const result = await JournalService.voidEntry(id, ctx);
            revalidateTag(ACCOUNTING_TAGS.JOURNAL);
            return result.data;
        }, 'accounting:voidJournal');
    }, { context: { action: 'voidJournalAction', id } });
}

/** ดึงข้อมูลพรีวิวการลงบัญชีสำหรับใบแจ้งหนี้ — delegates to InvoiceService (SSOT) */
export async function getInvoicePostingPreviewAction(invoiceId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            const invoiceData = await InvoiceService.getById(ctx, invoiceId);
            return await PostingService.previewInvoice(ctx, invoiceData);
        }, 'accounting:getInvoicePostingPreview');
    }, { context: { action: 'getInvoicePostingPreviewAction', invoiceId } });
}

/** ดึงข้อมูลพรีวิวการลงบัญชีสำหรับรายการชำระเงิน */
export async function getPaymentPostingPreviewAction(paymentData: any): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await PostingService.previewPayment(ctx, paymentData);
        }, 'accounting:getPaymentPostingPreview');
    }, { context: { action: 'getPaymentPostingPreviewAction' } });
}

/** ดึง JournalEntry จาก Source Document */
export async function getJournalEntryBySourceAction(sourceType: string, sourceId: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER');
            return await JournalService.getEntryBySource(ctx, sourceType, sourceId);
        }, 'accounting:getJournalEntryBySource');
    }, { context: { action: 'getJournalEntryBySourceAction' } });
}
