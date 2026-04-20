import { z } from 'zod';

export const orderRequestItemSchema = z.object({
    productId: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().min(1, 'จำนวนต้องมากกว่า 0'),
    uom: z.string().optional(),
});

export const orderRequestSchema = z.object({
    requesterId: z.string().min(1, 'กรุณาระบุผู้ขอซื้อ'),
    notes: z.string().optional(),
    items: z.array(orderRequestItemSchema).min(1, 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ'),
});

export type OrderRequestInput = z.infer<typeof orderRequestSchema>;
export type OrderRequestItemInput = z.infer<typeof orderRequestItemSchema>;
