'use server';

import { revalidatePath } from 'next/cache';
import { StockTransferService } from '@/services/inventory/stock-transfer.service';
import { stockTransferSchema } from '@/schemas/inventory/stock-transfer-form.schema';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/domain';

import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';
import { revalidateTag } from 'next/cache';
import { INVENTORY_TAGS } from '@/config/cache-tags';

export async function createStockTransferAction(data: any): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const context = await requireShop();
            await requirePermission('PRODUCT_UPDATE');

            const validatedData = stockTransferSchema.parse(data);
            const result = await StockTransferService.createTransfer(context as any, validatedData);

            revalidateTag(INVENTORY_TAGS.LIST);
            return result.data;
        });
    }, { context: { action: 'createStockTransfer' } });
}

export async function completeStockTransferAction(transferId: string): Promise<ActionResponse> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const context = await requireShop();
            await requirePermission('PRODUCT_UPDATE');

            const result = await StockTransferService.completeTransfer(context as any, transferId);

            revalidateTag(INVENTORY_TAGS.LIST);
            return result.data;
        });
    }, { context: { action: 'completeStockTransfer', transferId } });
}
