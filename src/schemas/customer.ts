import { z } from 'zod';

export const customerSchema = z.object({
  name: z
    .string()
    .min(1, 'กรุณากรอกชื่อลูกค้า')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .trim(),
  phone: z
    .string()
    .regex(/^[0-9-+() ]*$/, 'เบอร์โทรไม่ถูกต้อง')
    .max(20, 'เบอร์โทรต้องไม่เกิน 20 ตัวอักษร')
    .optional()
    .nullable(),
  email: z
    .string()
    .email('อีเมลไม่ถูกต้อง')
    .optional()
    .nullable()
    .or(z.literal('')),
  address: z
    .string()
    .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
