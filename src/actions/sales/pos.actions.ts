'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guard';
import { handleAction } from '@/lib/action-handler';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { ActionResponse } from '@/types/common';
import { POSSaleService, type POSCartInput } from '@/services/sales/pos-sale.service';

/**
 * posCheckout — Server Action หลัก สำหรับ POS Checkout
 *
 * เรียกจาก POS Interface เมื่อ User กด "ชำระเงิน"
 * ทุกอย่างเกิดใน 1 atomic transaction ใน POSSaleService.checkout()
 *
 * Return: { sale: { id, invoiceNumber, ... }, invoiceId }
 */
export async function posCheckout(cart: POSCartInput): Promise<ActionResponse<any>> {
    return handleAction(async () => {
        return PerformanceCollector.run(async () => {
            const ctx = await requirePermission('POS_ACCESS');
            const result = await POSSaleService.checkout(ctx, cart);

            // Revalidate: POS ส่งผลต่อ Sales, Invoices, Inventory ทั้งหมด
            revalidatePath('/sales');
            revalidatePath('/invoices');
            revalidatePath('/products');
            revalidatePath('/dashboard');

            return result;
        }, 'pos:checkout');
    }, { context: { action: 'posCheckout' } });
}
