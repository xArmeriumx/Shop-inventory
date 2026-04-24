import { z } from 'zod';

export const stockTransferSchema = z.object({
    fromWarehouseId: z.string().min(1, 'กรุณาเลือกคลังสินค้าต้นทาง'),
    toWarehouseId: z.string().min(1, 'กรุณาเลือกคลังสินค้าปลายทาง'),
    notes: z.string().optional(),
    lines: z.array(z.object({
        productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
        quantity: z.coerce.number().min(1, 'จำนวนต้องมากกว่า 0'),
    })).min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
}).refine(data => data.fromWarehouseId !== data.toWarehouseId, {
    message: 'คลังสินค้าต้นทางและปลายทางต้องไม่เป็นที่เดียวกัน',
    path: ['toWarehouseId'],
});

export type StockTransferFormValues = z.infer<typeof stockTransferSchema>;
