import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';
import { normalizePhone, normalizePostalCode, normalizeWhitespace } from '@/lib/normalizers';

export const customerAddressSchema = z.object({
  customerId: z.string().min(1, 'กรุณาเลือกลูกค้า'),
  label: z
    .string()
    .max(50, 'ป้ายกำกับต้องไม่เกิน 50 ตัวอักษร')
    .optional()
    .nullable()
    .transform(normalizeWhitespace),
  recipientName: z
    .string()
    .min(1, 'กรุณากรอกชื่อผู้รับ')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .transform(normalizeWhitespace)
    .transform((val) => val || '')
    .transform(sanitizeText),
  phone: z
    .preprocess((val) => normalizePhone(val as string), z.string().nullable())
    .refine((val) => !val || (val.length >= 9 && val.length <= 10), 'เบอร์โทรต้องมี 9-10 หลัก')
    .optional()
    .nullable(),
  address: z
    .string()
    .min(1, 'กรุณากรอกที่อยู่')
    .transform(normalizeWhitespace)
    .transform((val) => val || '')
    .transform(sanitizeText),
  district: z.string().max(100).optional().nullable().transform(normalizeWhitespace),
  subDistrict: z.string().max(100).optional().nullable().transform(normalizeWhitespace),
  province: z.string().max(100).optional().nullable().transform(normalizeWhitespace),
  postalCode: z
    .preprocess((val) => normalizePostalCode(val as string), z.string().nullable())
    .refine((val) => !val || val.length === 5, 'รหัสไปรษณีย์ต้องมี 5 หลัก')
    .optional()
    .nullable(),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressInput = z.infer<typeof customerAddressSchema>;
