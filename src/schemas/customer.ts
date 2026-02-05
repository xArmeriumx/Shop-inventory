import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณากรอกชื่อลูกค้า')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .trim()
    .transform(sanitizeText),
  phone: z
    .string()
    .regex(/^[0-9-+() ]*$/, 'เบอร์โทรไม่ถูกต้อง')
    .max(20, 'เบอร์โทรต้องไม่เกิน 20 ตัวอักษร')
    .optional()
    .nullable(),
  taxId: z
    .string()
    .max(13, 'เลขประจำตัวผู้เสียภาษีต้องไม่เกิน 13 ตัวอักษร')
    .optional()
    .nullable(),
  // Note: email field removed - not in Prisma Customer model
  address: z
    .string()
    .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
});

export type CustomerInput = z.infer<typeof customerSchema>;
