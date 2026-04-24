import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { normalizePhone, normalizeTaxId, normalizeEmail, normalizeWhitespace } from '@/lib/normalizers';
import { partnerAddressSchema, partnerContactSchema } from '@/schemas/core/partner-common.schema';

export const customerSchema = z.object({
  name: z
    .string()
    .transform((v) => normalizeWhitespace(v) || '')
    .pipe(
      z.string()
        .min(1, 'กรุณากรอกชื่อลูกค้า')
        .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
        .transform(sanitizeText)
    ),
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
  address: z
    .string()
    .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  shippingAddress: z
    .string()
    .max(500, 'ที่อยู่จัดส่งต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  billingAddress: z
    .string()
    .max(500, 'ที่อยู่แจ้งหนี้ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(normalizeWhitespace(val) || '') : val),
  region: z
    .string()
    .optional()
    .nullable(),
  groupCode: z
    .string()
    .optional()
    .nullable(),
  creditLimit: z.coerce
    .number()
    .min(0, 'วงเงินเครดิตต้องไม่ติดลบ')
    .optional()
    .nullable(),
  creditTerm: z.coerce
    .number()
    .int('ระยะเวลาเครดิตต้องเป็นจำนวนเต็ม')
    .min(0, 'ระยะเวลาเครดิตต้องไม่ติดลบ')
    .optional()
    .nullable(),

  partnerAddresses: z.array(partnerAddressSchema).optional().default([]),
});

export type CustomerInput = z.input<typeof customerSchema>;
