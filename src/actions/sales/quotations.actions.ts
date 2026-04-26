'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { quotationSchema, type QuotationInput } from '@/schemas/sales/quotation.schema';
import { QuotationService } from '@/services/sales/quotation.service';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

export async function getQuotations(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_VIEW' as any);
            return QuotationService.list(ctx, params);
        }, 'sales:getQuotations');
    }, { context: { action: 'getQuotations' } });
}

export async function createQuotation(input: QuotationInput): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_CREATE' as any);
            const validated = quotationSchema.parse(input);
            const result = await QuotationService.create(ctx, validated);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
        }, 'sales:createQuotation');
    }, { context: { action: 'createQuotation' } });
}

export async function confirmQuotation(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_CONFIRM' as any);
            const result = await QuotationService.confirm(ctx, id);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
        }, 'sales:confirmQuotation');
    }, { context: { action: 'confirmQuotation', id } });
}

export async function cancelQuotation(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('QUOTATION_EDIT' as any);
            const result = await QuotationService.cancel(ctx, id);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
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
