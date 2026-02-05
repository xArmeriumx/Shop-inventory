import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณากรอกชื่อสินค้า')
    .max(200, 'ชื่อสินค้าต้องไม่เกิน 200 ตัวอักษร')
    .trim()
    .transform(sanitizeText),
  description: z
    .string()
    .max(1000, 'รายละเอียดต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  sku: z
    .string()
    .max(50, 'SKU ต้องไม่เกิน 50 ตัวอักษร')
    .regex(/^[A-Za-z0-9-_]*$/, 'SKU ต้องเป็นตัวอักษร ตัวเลข หรือ - _ เท่านั้น')
    .optional()
    .nullable(),
  category: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
  costPrice: z
    .number({ invalid_type_error: 'กรุณากรอกราคาทุน' })
    .min(0, 'ราคาทุนต้องไม่ติดลบ')
    .max(999999999, 'ราคาทุนสูงเกินไป'),
  salePrice: z
    .number({ invalid_type_error: 'กรุณากรอกราคาขาย' })
    .min(0, 'ราคาขายต้องไม่ติดลบ')
    .max(999999999, 'ราคาขายสูงเกินไป'),
  stock: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนสต็อก' })
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ'),
  minStock: z
    .number()
    .int()
    .min(0)
    .default(5),
  images: z.array(z.string().url()).optional().default([]),
});

export const productUpdateSchema = productSchema.partial().extend({
  version: z.number().int().optional(),  // Optimistic locking version
});

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
