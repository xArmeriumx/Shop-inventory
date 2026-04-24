'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
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
            await QuotationService.confirm(ctx, id);
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
            await QuotationService.cancel(ctx, id);
            revalidatePath('/quotations');
            return null;
        }, 'sales:cancelQuotation');
    }, { context: { action: 'cancelQuotation', id } });
}
