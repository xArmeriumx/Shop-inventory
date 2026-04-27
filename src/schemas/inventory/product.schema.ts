import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { normalizeSku, normalizeWhitespace } from '@/lib/normalizers';

export const productSchema = z.object({
  name: z
    .string()
    .transform((v) => normalizeWhitespace(v) || '')
    .pipe(
      z.string()
        .min(1, 'กรุณากรอกชื่อสินค้า')
        .max(200, 'ชื่อสินค้าต้องไม่เกิน 200 ตัวอักษร')
        .transform(sanitizeText)
    ),
  description: z
    .string()
    .optional()
    .nullable()
    .transform(v => normalizeWhitespace(v))
    .pipe(
      z.string()
        .max(1000, 'รายละเอียดต้องไม่เกิน 1000 ตัวอักษร')
        .transform(sanitizeText)
        .optional()
        .nullable()
    ),
  sku: z
    .string()
    .optional()
    .nullable()
    .transform(normalizeSku)
    .pipe(
      z.string()
        .nullable()
        .refine((val) => !val || /^[A-Z0-9_-]+$/.test(val), 'SKU ใช้ได้เฉพาะ A-Z, 0-9, _ และ -')
    ),
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
    .min(0, 'จำนวนสต็อกต้องไม่ติดลบ'),
  minStock: z
    .number()
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนขั้นต่ำต้องไม่ติดลบ')
    .default(5),
  moq: z
    .number()
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'MOQ ต้องไม่ติดลบ')
    .optional()
    .nullable(),
  packagingQty: z
    .number()
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(1, 'จำนวนต่อแพ็กต้องมีอย่างน้อย 1')
    .default(1),
  metadata: z
    .record(z.any())
    .optional()
    .nullable(),
  images: z.array(z.string().url('รูปแบบ URL รูปภาพไม่ถูกต้อง')).optional().default([]),
  isActive: z.boolean().optional().default(true),
  isSaleable: z.boolean().optional().default(true),
  initialStocks: z.array(z.object({
    warehouseId: z.string(),
    warehouseName: z.string(),
    quantity: z.number().int().min(0).default(0),
    binLocation: z.string().optional().default(''),
  })).optional().default([]),
});

export const productUpdateSchema = productSchema.partial().extend({
  version: z.number().int().optional(),  // Optimistic locking version
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type ProductOutput = z.infer<typeof productSchema>;
