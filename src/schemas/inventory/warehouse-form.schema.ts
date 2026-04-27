
import { z } from 'zod';

export const warehouseSchema = z.object({
    name: z.string().min(1, 'กรุณาระบุชื่อคลังสินค้า'),
    code: z.string().min(1, 'กรุณาระบุรหัสคลังสินค้า'),
    address: z.string().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;
