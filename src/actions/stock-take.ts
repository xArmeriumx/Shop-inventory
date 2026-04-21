'use server';

import { revalidatePath } from 'next/cache';
import { StockTakeService } from '@/services/stock-take.service';
import { requireShop, requirePermission } from '@/lib/auth-guard';

export async function createStockTakeAction(productIds: string[], notes?: string) {
    const ctx = await requireShop();
    await requirePermission('STOCK_ADJUST');

    const session = await StockTakeService.createSession(productIds, notes, ctx);

    revalidatePath('/inventory/stock-take');
    return session;
}

export async function updateStockTakeItemAction(sessionId: string, productId: string, countedQty: number, note?: string) {
    const ctx = await requireShop();
    // Anyone with CREATE permission can update the count in DRAFT
    await requirePermission('STOCK_ADJUST');

    const item = await StockTakeService.updateActualCount(sessionId, productId, countedQty, note, ctx);

    revalidatePath(`/inventory/stock-take/${sessionId}`);
    return item;
}

export async function submitStockTakeAction(sessionId: string) {
    const ctx = await requireShop();
    await requirePermission('STOCK_ADJUST');

    await StockTakeService.submitSession(sessionId, ctx);

    revalidatePath(`/inventory/stock-take/${sessionId}`);
    revalidatePath('/inventory/stock-take');
}

export async function completeStockTakeAction(sessionId: string) {
    const ctx = await requireShop();
    await requirePermission('STOCK_TAKE_APPROVE');

    await StockTakeService.completeSession(sessionId, ctx);

    revalidatePath(`/inventory/stock-take/${sessionId}`);
    revalidatePath('/inventory/stock-take');
    revalidatePath('/inventory'); // Update dashboard totals
}

export async function cancelStockTakeAction(sessionId: string, reason: string) {
    const ctx = await requireShop();
    await requirePermission('STOCK_ADJUST');

    await StockTakeService.cancelSession(sessionId, reason, ctx);

    revalidatePath(`/inventory/stock-take/${sessionId}`);
    revalidatePath('/inventory/stock-take');
}
