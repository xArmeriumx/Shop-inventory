import { z } from 'zod';
import { sanitizeText } from '@/lib/sanitize';

export const INCOME_CATEGORIES = [
  { value: 'SERVICE', label: 'ค่าบริการ/ค่าซ่อม' },
  { value: 'INSTALLATION', label: 'ค่าติดตั้ง/ค่าแรง' },
  { value: 'RENTAL', label: 'ค่าเช่า' },
  { value: 'COMMISSION', label: 'ค่าคอมมิชชั่น' },
  { value: 'TIP', label: 'เงินทิป' },
  { value: 'REFUND', label: 'เงินคืน/ชดเชย' },
  { value: 'DELIVERY', label: 'ค่าจัดส่ง' },
  { value: 'OTHER', label: 'อื่นๆ' },
] as const;

export const incomeSchema = z.object({
  description: z
    .string()
    .min(1, 'กรุณากรอกรายละเอียด')
    .max(500, 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร')
    .trim()
    .transform(sanitizeText),
  amount: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .min(0.01, 'จำนวนเงินต้องมากกว่า 0'),
  category: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
  date: z.coerce.date({ invalid_type_error: 'กรุณาเลือกวันที่' }),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((val) => val ? sanitizeText(val) : val),
});

export type IncomeInput = z.infer<typeof incomeSchema>;
