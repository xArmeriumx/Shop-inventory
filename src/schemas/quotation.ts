import { z } from 'zod';

export const quotationItemSchema = z.object({
    productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
    description: z.string().optional(),
    quantity: z.number().min(1, 'จำนวนต้องมากกว่า 0'),
    unitPrice: z.number().min(0, 'ราคาต้องไม่ติดลบ'),
    discount: z.number().min(0).default(0),
});

export const quotationSchema = z.object({
    customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
    salespersonId: z.string().optional(),
    date: z.date().optional().default(() => new Date()),
    validUntil: z.date().optional(),
    currencyCode: z.string().default('THB'),
    notes: z.string().optional(),
    items: z.array(quotationItemSchema).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

export type QuotationInput = z.infer<typeof quotationSchema>;
export type QuotationItemInput = z.infer<typeof quotationItemSchema>;
