import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'กรุณาเลือกสินค้า'),
  quantity: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวน' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนต้องมากกว่า 0'),
  costPrice: z
    .number({ invalid_type_error: 'กรุณากรอกต้นทุน' })
    .min(0, 'ราคาต้องไม่ติดลบ'),
});

export const purchaseSchema = z.object({
  supplierId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'TRANSFER', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกวิธีชำระเงิน' }),
  }),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  receiptUrl: z.string().url().optional().nullable(),
  purchaseType: z.enum(['LOCAL', 'FOREIGN']).default('LOCAL'),
  docType: z.enum(['REQUEST', 'ORDER']).default('ORDER'),
  linkedPRId: z.string().optional().nullable(),
  items: z
    .array(purchaseItemSchema)
    .min(1, 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'),
  date: z.string().optional(),
});

export type PurchaseInput = z.input<typeof purchaseSchema>;
export type PurchaseOutput = z.infer<typeof purchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;
