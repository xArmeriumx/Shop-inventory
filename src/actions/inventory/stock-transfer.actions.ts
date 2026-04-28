'use server';

import { revalidateTag } from 'next/cache';
import { StockTransferService } from '@/services/inventory/stock-transfer.service';
import { stockTransferSchema } from '@/schemas/inventory/stock-transfer-form.schema';
import { requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/domain';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { INVENTORY_TAGS } from '@/config/cache-tags';

// Fix #1: Use single requirePermission call (eliminates double Auth/DB round-trip)
// Fix #2: Revalidate both list + affected product details via result.affectedTags

export async function createStockTransferAction(data: any): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            // Single auth call — `requirePermission` returns full ctx (same as requireShop)
            const ctx = await requirePermission('PRODUCT_UPDATE');
            const validatedData = stockTransferSchema.parse(data);
            const result = await StockTransferService.createTransfer(ctx as any, validatedData);

            // Revalidate using service-driven tags (respects which products were affected)
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            } else {
                // Fallback: revalidate inventory list
                revalidateTag(INVENTORY_TAGS.LIST);
                revalidateTag(INVENTORY_TAGS.WAREHOUSE.LIST);
            }

            return result.data;
        }, 'inventory:createStockTransfer');
    }, { context: { action: 'createStockTransfer' } });
}

export async function completeStockTransferAction(transferId: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            // Single auth call
            const ctx = await requirePermission('PRODUCT_UPDATE');
            const result = await StockTransferService.completeTransfer(ctx as any, transferId);

            // Revalidate using service-driven tags
            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            } else {
                revalidateTag(INVENTORY_TAGS.LIST);
                revalidateTag(INVENTORY_TAGS.WAREHOUSE.LIST);
            }

            return result.data;
        }, 'inventory:completeStockTransfer');
    }, { context: { action: 'completeStockTransfer', transferId } });
}
