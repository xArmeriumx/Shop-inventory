/**
 * Purchase Form Schema
 */
import { z } from 'zod';

export const purchaseItemSchema = z.object({
    productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
    quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
    costPrice: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
});

export const purchaseFormSchema = z.object({
    supplierId: z.string().min(1, 'กรุณาเลือกผู้จำหน่าย'),
    paymentMethod: z.string().min(1, 'กรุณาเลือกวิธีชำระเงิน'),
    notes: z.string().optional().nullable(),
    receiptUrl: z.string().optional().nullable(),
    isBackdated: z.boolean().default(false),
    date: z.string().optional().nullable(),
    items: z.array(purchaseItemSchema).min(1, 'ต้องมีสินค้าอย่างน้อย 1 รายการ'),
});

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

export function getPurchaseFormDefaults(): PurchaseFormValues {
    return {
        supplierId: '',
        paymentMethod: '',
        notes: '',
        receiptUrl: null,
        isBackdated: false,
        date: new Date().toISOString().slice(0, 16),
        items: [{ productId: '', quantity: 1, costPrice: 0 }],
    };
}
