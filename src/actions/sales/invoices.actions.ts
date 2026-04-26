'use server';

import { revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { InvoiceService } from '@/services/sales/invoice.service';
import type { ActionResponse } from '@/types/domain';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

export async function getInvoices(params: any = {}): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_VIEW');
            return InvoiceService.list(ctx, params);
        }, 'sales:getInvoices');
    }, { context: { action: 'getInvoices' } });
}

export async function getInvoiceById(id: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_VIEW');
            return InvoiceService.getById(ctx, id);
        }, 'sales:getInvoiceById');
    }, { context: { action: 'getInvoiceById', id } });
}

export async function createInvoiceFromSale(saleId: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_CREATE');
            const result = await InvoiceService.createFromSale(ctx, saleId);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }
            
            return { id: (result.data as any).id };
        }, 'sales:createInvoiceFromSale');
    }, { context: { action: 'createInvoiceFromSale', saleId } });
}

export async function postInvoice(id: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_CREATE');
            const result = await InvoiceService.post(ctx, id);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'sales:postInvoice');
    }, { context: { action: 'postInvoice', id } });
}

export async function markInvoicePaid(id: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('FINANCE_VIEW_LEDGER' as any);
            const result = await InvoiceService.markPaid(ctx, id);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'sales:markInvoicePaid');
    }, { context: { action: 'markInvoicePaid', id } });
}

export async function cancelInvoice(id: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_CANCEL');
            const result = await InvoiceService.cancel(ctx, id);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'sales:cancelInvoice');
    }, { context: { action: 'cancelInvoice', id } });
}

export async function getInvoiceStats(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('SALE_VIEW');
            return InvoiceService.getStats(ctx);
        }, 'sales:getInvoiceStats');
    }, { context: { action: 'getInvoiceStats' } });
}

export async function bulkPostInvoices(): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('INVOICE_POST' as any);
            const result = await InvoiceService.bulkPost(ctx);
            
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
        }, 'sales:bulkPostInvoices');
    }, { context: { action: 'bulkPostInvoices' } });
}
