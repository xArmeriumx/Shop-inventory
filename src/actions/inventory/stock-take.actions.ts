'use server';

import { revalidatePath } from 'next/cache';
import { StockTakeService } from '@/services/inventory/stock-take.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ActionResponse } from '@/types/common';

/**
 * Create a new stock-take session
 */
export async function createStockTakeAction(productIds: string[], notes?: string): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requireShop();
            await requirePermission('STOCK_ADJUST');
            const session = await StockTakeService.createSession(productIds, notes, ctx);
            revalidatePath('/inventory/stock-take');
            return session;
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
            const item = await StockTakeService.updateActualCount(sessionId, productId, countedQty, note, ctx);
            revalidatePath(`/inventory/stock-take/${sessionId}`);
            return item;
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
            await StockTakeService.submitSession(sessionId, ctx);
            revalidatePath(`/inventory/stock-take/${sessionId}`);
            revalidatePath('/inventory/stock-take');
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
            await StockTakeService.completeSession(sessionId, ctx);
            revalidatePath(`/inventory/stock-take/${sessionId}`);
            revalidatePath('/inventory/stock-take');
            revalidatePath('/inventory');
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
            await StockTakeService.cancelSession(sessionId, reason, ctx);
            revalidatePath(`/inventory/stock-take/${sessionId}`);
            revalidatePath('/inventory/stock-take');
            return null;
        }, 'inventory:cancelStockTake');
    }, { context: { action: 'cancelStockTake', sessionId, reason } });
}
