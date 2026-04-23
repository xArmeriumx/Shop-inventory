'use server';

import { revalidatePath } from 'next/cache';
import { StockTransferService } from '@/services/inventory/stock-transfer.service';
import { stockTransferSchema } from '@/schemas/stock-transfer-form';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/domain';

export async function createStockTransferAction(data: any): Promise<ActionResponse> {
    try {
        const context = await requireShop();
        await requirePermission('PRODUCT_UPDATE');

        const validatedData = stockTransferSchema.parse(data);

        await StockTransferService.createTransfer(context as any, validatedData);

        revalidatePath('/inventory/transfers');
        return { success: true, message: 'สร้างใบโอนสินค้าสำเร็จ' };
    } catch (error: any) {
        return { success: false, errors: { root: [error.message] } };
    }
}

export async function completeStockTransferAction(transferId: string): Promise<ActionResponse> {
    try {
        const context = await requireShop();
        await requirePermission('PRODUCT_UPDATE');

        await StockTransferService.completeTransfer(context as any, transferId);

        revalidatePath('/inventory/transfers');
        revalidatePath('/products');
        return { success: true, message: 'ยืนยันใบโอนสินค้าและอัปเดตสต็อกสำเร็จ' };
    } catch (error: any) {
        return { success: false, errors: { root: [error.message] } };
    }
}
