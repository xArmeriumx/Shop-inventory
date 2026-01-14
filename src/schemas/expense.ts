import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  { value: 'RENT', label: 'ค่าเช่า' },
  { value: 'UTILITIES', label: 'ค่าน้ำ/ไฟ' },
  { value: 'SALARY', label: 'เงินเดือน' },
  { value: 'SUPPLIES', label: 'วัสดุสิ้นเปลือง' },
  { value: 'TRANSPORTATION', label: 'ค่าขนส่ง' },
  { value: 'MARKETING', label: 'การตลาด/โฆษณา' },
  { value: 'MAINTENANCE', label: 'ซ่อมบำรุง' },
  { value: 'FOOD', label: 'อาหาร/เครื่องดื่ม' },
  { value: 'OTHER', label: 'อื่นๆ' },
] as const;

export const expenseSchema = z.object({
  description: z
    .string()
    .min(1, 'กรุณากรอกรายละเอียด')
    .max(500, 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร')
    .trim(),
  amount: z
    .number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' })
    .min(0.01, 'จำนวนเงินต้องมากกว่า 0'),
  category: z.enum(
    ['RENT', 'UTILITIES', 'SALARY', 'SUPPLIES', 'TRANSPORTATION', 'MARKETING', 'MAINTENANCE', 'FOOD', 'OTHER'],
    { errorMap: () => ({ message: 'กรุณาเลือกหมวดหมู่' }) }
  ),
  date: z.coerce.date({ invalid_type_error: 'กรุณาเลือกวันที่' }),
  notes: z
    .string()
    .max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร')
    .optional()
    .nullable(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
