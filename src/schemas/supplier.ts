import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const supplierSchema = z.object({
  name: z.string()
    .min(1, 'กรุณากรอกชื่อผู้จำหน่าย')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .transform(sanitizeText),
  code: z.string()
    .max(50, 'รหัสต้องไม่เกิน 50 ตัวอักษร')
    .optional()
    .nullable(),
  contactName: z.string()
    .max(100, 'ชื่อผู้ติดต่อต้องไม่เกิน 100 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  phone: z.string()
    .max(20, 'หมายเลขโทรศัพท์ต้องไม่เกิน 20 ตัวอักษร')
    .optional()
    .nullable(),
  email: z.string()
    .email('อีเมลไม่ถูกต้อง')
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z.string()
    .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
  taxId: z.string()
    .max(20, 'เลขผู้เสียภาษีต้องไม่เกิน 20 ตัวอักษร')
    .optional()
    .nullable(),
  notes: z.string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
