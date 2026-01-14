import { z } from 'zod';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  quantity: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวน' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนต้องมากกว่า 0'),
  salePrice: z
    .number({ invalid_type_error: 'กรุณากรอกราคาขาย' })
    .min(0, 'ราคาต้องไม่ติดลบ'),
  costPrice: z.number().min(0).optional(),
});

export const saleSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z
    .string()
    .max(200, 'ชื่อลูกค้าต้องไม่เกิน 200 ตัวอักษร')
    .optional()
    .nullable(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกวิธีชำระเงิน' }),
  }),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable(),
  items: z
    .array(saleItemSchema)
    .min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
