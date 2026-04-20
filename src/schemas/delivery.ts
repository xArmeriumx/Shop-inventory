import { z } from 'zod';

export const deliveryOrderItemSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().min(1),
});

export const deliveryOrderSchema = z.object({
    saleId: z.string().min(1, 'กรุณาระบุรายการขาย'),
    scheduledDate: z.date().optional(),
    notes: z.string().optional(),
    items: z.array(deliveryOrderItemSchema).min(1, 'กรุณาระบุรายการสินค้า'),
});

export type DeliveryOrderInput = z.infer<typeof deliveryOrderSchema>;
