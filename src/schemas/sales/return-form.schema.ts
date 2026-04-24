/**
 * Return Form Schema
 */
import { z } from 'zod';

export const returnItemSchema = z.object({
    saleItemId: z.string().min(1),
    productId: z.string().min(1),
    productName: z.string(),
    quantity: z.coerce.number().min(1, 'จำนวนต้องอย่างน้อย 1'),
    refundPerUnit: z.coerce.number().min(0, 'ราคาคืนเงินต้องไม่ติดลบ'),
    maxReturnable: z.number(), // Used for client-side validation logic
});

export const returnFormSchema = z.object({
    saleId: z.string().min(1, 'กรุณาเลือกบิลขาย'),
    reason: z.string().min(1, 'กรุณาระบุเหตุผลการคืน').max(500, 'เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
    refundMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
        errorMap: () => ({ message: 'กรุณาเลือกวิธีคืนเงิน' }),
    }),
    items: z.array(returnItemSchema).min(1, 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'),
});

export type ReturnFormValues = z.infer<typeof returnFormSchema>;

export function getReturnFormDefaults(saleId?: string): ReturnFormValues {
    return {
        saleId: saleId || '',
        reason: '',
        refundMethod: 'CASH',
        items: [],
    };
}
