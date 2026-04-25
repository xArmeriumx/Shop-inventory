'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { quotationSchema, type QuotationInput } from '@/schemas/sales/quotation.schema';
import { QuotationService } from '@/services/sales/quotation.service';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { AuditService } from '@/services/core/system/audit.service';


export async function getQuotations(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_VIEW' as any);
            return QuotationService.list(ctx, params);
        }, 'sales:getQuotations');
    }, { context: { action: 'getQuotations' } });
}


export async function createQuotation(input: QuotationInput): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_CREATE' as any);
            const validated = quotationSchema.parse(input);
            await QuotationService.create(ctx, validated);
            revalidatePath('/quotations');
            return null;
        }, 'sales:createQuotation');
    }, { context: { action: 'createQuotation' } });
}

export async function confirmQuotation(id: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_CONFIRM' as any);
            
            // 🛡️ Snapshot BEFORE
            const before = await QuotationService.getById(ctx, id);
            
            await QuotationService.confirm(ctx, id);

            // 🛡️ Snapshot AFTER
            const after = await QuotationService.getById(ctx, id);

            AuditService.record({
                action: 'QUOTATION_CONFIRM',
                targetType: 'Quotation',
                targetId: id,
                note: `ยืนยันใบเสนอราคา QT: ${before.quotationNo} -> สร้างรายการขาย (SO)`,
                before,
                after,
                actorId: ctx.userId,
                shopId: ctx.shopId
            }).catch(err => console.error('[Audit] Log failed', err));

            revalidatePath('/quotations');
            revalidatePath('/sales');
            return null;
        }, 'sales:confirmQuotation');
    }, { context: { action: 'confirmQuotation', id } });
}

export async function cancelQuotation(id: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_EDIT' as any);
            
            // 🛡️ Snapshot BEFORE
            const before = await QuotationService.getById(ctx, id);
            
            await QuotationService.cancel(ctx, id);

            // 🛡️ Snapshot AFTER
            const after = await QuotationService.getById(ctx, id);

            AuditService.record({
                action: 'QUOTATION_CANCEL',
                targetType: 'Quotation',
                targetId: id,
                note: `ยกเลิกใบเสนอราคา QT: ${before.quotationNo}`,
                before,
                after,
                actorId: ctx.userId,
                shopId: ctx.shopId
            }).catch(err => console.error('[Audit] Log failed', err));

            revalidatePath('/quotations');
            return null;
        }, 'sales:cancelQuotation');
    }, { context: { action: 'cancelQuotation', id } });
}
export async function getQuotationDetail(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_VIEW' as any);
            return QuotationService.getById(ctx, id);
        }, `sales:getQuotationDetail:${id}`);
    }, { context: { action: 'getQuotationDetail', id } });
}
