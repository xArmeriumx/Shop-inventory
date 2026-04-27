'use server';

import { revalidateTag } from 'next/cache';
import { StockTakeService } from '@/services/inventory/stock-take.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ActionResponse } from '@/types/common';

/**
 * Create a new stock-take session
 */
export async function createStockTakeAction(productIds: string[], notes?: string, warehouseId?: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_ADJUST');
            const result = await StockTakeService.createSession(productIds, notes, ctx, warehouseId);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
        }, 'inventory:createStockTake');
    }, { context: { action: 'createStockTake', productCount: productIds.length } });
}

/**
 * Update actual count for an item in a session
 */
export async function updateStockTakeItemAction(sessionId: string, productId: string, countedQty: number, note?: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_ADJUST');
            const result = await StockTakeService.updateActualCount(sessionId, productId, countedQty, note, ctx);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return result.data;
        }, 'inventory:updateStockTakeItem');
    }, { context: { action: 'updateStockTakeItem', sessionId, productId, countedQty } });
}

/**
 * Submit session for approval
 */
export async function submitStockTakeAction(sessionId: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_ADJUST');
            const result = await StockTakeService.submitSession(sessionId, ctx);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'inventory:submitStockTake');
    }, { context: { action: 'submitStockTake', sessionId } });
}

/**
 * Approve and complete stock-take session
 */
export async function completeStockTakeAction(sessionId: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_TAKE_APPROVE');
            const result = await StockTakeService.completeSession(sessionId, ctx);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'inventory:completeStockTake');
    }, { context: { action: 'completeStockTake', sessionId } });
}

/**
 * Cancel stock-take session
 */
export async function cancelStockTakeAction(sessionId: string, reason: string): Promise<ActionResponse<null>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_ADJUST');
            const result = await StockTakeService.cancelSession(sessionId, reason, ctx);

            if (result.affectedTags) {
                result.affectedTags.forEach(tag => revalidateTag(tag));
            }

            return null;
        }, 'inventory:cancelStockTake');
    }, { context: { action: 'cancelStockTake', sessionId, reason } });
}
