/**
 * Income Form Schema
 * 
 * Client-side validation for react-hook-form.
 * Backend schema handles sanitization.
 */
import { z } from 'zod';

export const incomeFormSchema = z.object({
    description: z.string().min(1, 'กรุณากรอกรายละเอียด').max(500, 'รายละเอียดต้องไม่เกิน 500 ตัวอักษร'),
    amount: z.coerce.number({ invalid_type_error: 'กรุณากรอกจำนวนเงิน' }).min(0.01, 'จำนวนเงินต้องมากกว่า 0'),
    category: z.string().min(1, 'กรุณาเลือกหมวดหมู่'),
    date: z.string().min(1, 'กรุณาเลือกวันที่'),
    notes: z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร').optional().nullable(),
});

export type IncomeFormValues = z.infer<typeof incomeFormSchema>;

function formatDateForInput(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
}

export function getIncomeFormDefaults(income?: any): IncomeFormValues {
    return {
        description: income?.description ?? '',
        amount: income?.amount ? Number(income.amount) : 0,
        category: income?.category ?? '',
        date: income?.date ? formatDateForInput(income.date) : formatDateForInput(new Date()),
        notes: income?.notes ?? '',
    };
}
