'use server';

import { JournalService } from '@/services/journal.service';
import { requireShop } from '@/lib/auth-guard';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { PostingService } from '@/services/posting-engine.service';
import { getPaymentHistoryAction } from './payments';
import { ActionResponse } from '@/types/domain';

/**
 * ดึงรายการสมุดรายวัน
 */
export async function getJournalsAction(params: {
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}) {
    try {
        const ctx = await requireShop();
        const data = await JournalService.getEntries(ctx, {
            ...params,
            startDate: params.startDate ? new Date(params.startDate) : undefined,
            endDate: params.endDate ? new Date(params.endDate) : undefined,
        });
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * สร้างรายการสมุดรายวัน
 */
export async function createJournalAction(data: any) {
    try {
        const ctx = await requireShop();
        const result = await JournalService.createEntry(ctx, {
            ...data,
            journalDate: new Date(data.journalDate),
        });
        revalidatePath('/settings/accounting');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ยืนยันการลงรายการ (Post)
 */
export async function postJournalAction(id: string) {
    try {
        const ctx = await requireShop();
        const result = await JournalService.postEntry(id, ctx);
        revalidatePath('/settings/accounting');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ยกเลิกรายการ (Void)
 */
export async function voidJournalAction(id: string) {
    try {
        const ctx = await requireShop();
        const result = await JournalService.voidEntry(id, ctx);
        revalidatePath('/settings/accounting');
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ดึงข้อมูลพรีวิวการลงบัญชีสำหรับใบแจ้งหนี้
 */
export async function getInvoicePostingPreviewAction(invoiceId: string) {
    try {
        const ctx = await requireShop();
        const invoice = await (db as any).invoice.findUnique({
            where: { id: invoiceId, shopId: ctx.shopId },
        });

        if (!invoice) return { success: false, error: 'Invoice not found' };

        const preview = await PostingService.previewInvoice(ctx, invoice);
        return { success: true, data: preview };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * ดึงข้อมูลพรีวิวการลงบัญชีสำหรับรายการชำระเงิน
 */
export async function getPaymentPostingPreviewAction(paymentData: any) {
    try {
        const ctx = await requireShop();
        const preview = await PostingService.previewPayment(ctx, paymentData);
        return { success: true, data: preview };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getJournalEntryBySourceAction(sourceType: string, sourceId: string): Promise<ActionResponse<any>> {
    try {
        const ctx = await requireShop();
        const entry = await JournalService.getEntryBySource(ctx, sourceType, sourceId);
        return { success: true, data: entry };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}
