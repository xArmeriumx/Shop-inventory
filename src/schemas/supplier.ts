import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { normalizePhone, normalizeTaxId, normalizeEmail, normalizeWhitespace } from '@/lib/normalizers';

export const supplierSchema = z.object({
  name: z.string()
    .transform((v) => normalizeWhitespace(v) || '')
    .pipe(
      z.string()
        .min(1, 'กรุณากรอกชื่อผู้จำหน่าย')
        .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
        .transform(sanitizeText)
    ),
  code: z.string()
    .max(50, 'รหัสต้องไม่เกิน 50 ตัวอักษร')
    .optional()
    .nullable(),
  contactName: z.string()
    .max(100, 'ชื่อผู้ติดต่อต้องไม่เกิน 100 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform(normalizePhone)
    .pipe(
      z.string()
        .nullable()
        .refine((val) => !val || (val.length >= 9 && val.length <= 10), 'เบอร์โทรต้องมี 9-10 หลัก')
    ),
  email: z
    .string()
    .optional()
    .nullable()
    .transform(normalizeEmail)
    .pipe(
      z.string()
        .nullable()
        .refine((val) => !val || z.string().email().safeParse(val).success, 'รูปแบบอีเมลไม่ถูกต้อง')
    ),
  address: z.string()
    .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  taxId: z
    .string()
    .optional()
    .nullable()
    .transform(normalizeTaxId)
    .pipe(
      z.string()
        .nullable()
        .refine((val) => !val || val.length === 13, 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก')
    ),
  notes: z.string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),

  // ERP Phase 8 Fields
  creditLimit: z.coerce.number()
    .min(0, 'วงเงินเครดิตต้องไม่ติดลบ')
    .optional()
    .nullable(),
  creditTerm: z.coerce.number()
    .int('เครดิตเทอมต้องเป็นจำนวนเต็ม')
    .min(0, 'เครดิตเทอมต้องไม่ติดลบ')
    .optional()
    .nullable(),
  paymentTerms: z.string()
    .max(1000)
    .optional()
    .nullable(),

  // Rule 6: Nested addresses for CRUD
  addresses: z.array(z.any()).optional().default([]),
});

export type SupplierInput = z.input<typeof supplierSchema>;
