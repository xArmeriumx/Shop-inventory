/**
 * Sale Form Schema
 */
import { z } from 'zod';

export const saleItemSchema = z.object({
    productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
    quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
    salePrice: z.coerce.number().min(0, 'ราคาต้องไม่ติดลบ'),
    discountAmount: z.coerce.number().min(0).default(0),
});

export const saleFormSchema = z.object({
    customerId: z.string().optional().nullable(),
    customerName: z.string().optional().nullable(),
    customerAddress: z.string().optional().nullable(),
    isNewCustomer: z.boolean().default(false),
    showAddress: z.boolean().default(false),
    paymentMethod: z.string().min(1, 'กรุณาเลือกวิธีชำระเงิน'),
    notes: z.string().optional().nullable(),
    receiptUrl: z.string().optional().nullable(),
    isBackdated: z.boolean().default(false),
    date: z.string().optional().nullable(),
    items: z.array(saleItemSchema).min(1, 'ต้องมีสินค้าอย่างน้อย 1 รายการ'),
    showDiscount: z.boolean().default(false),
    discountType: z.enum(['FIXED', 'PERCENT']).nullable().optional(),
    discountValue: z.coerce.number().min(0).nullable().optional(),
});

export type SaleFormValues = z.infer<typeof saleFormSchema>;

export function getSaleFormDefaults(): SaleFormValues {
    return {
        customerId: null,
        customerName: null,
        customerAddress: null,
        isNewCustomer: false,
        showAddress: false,
        paymentMethod: '',
        notes: '',
        receiptUrl: null,
        isBackdated: false,
        date: new Date().toISOString().slice(0, 16),
        items: [{ productId: '', quantity: 1, salePrice: 0, discountAmount: 0 }],
        showDiscount: false,
        discountType: 'FIXED',
        discountValue: 0,
    };
}
