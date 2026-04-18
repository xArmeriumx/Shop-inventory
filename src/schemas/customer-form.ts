/**
 * Customer Form Schema
 * 
 * Client-side validation for react-hook-form.
 * Normalization (phone stripping, taxId cleanup) happens in the backend schema.
 */
import { z } from 'zod';

export const customerFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อลูกค้า').max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร'),
    phone: z.string().max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก').optional().nullable(),
    email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).optional().nullable()
        .or(z.literal('')).transform(v => v || null),
    address: z.string().max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
    taxId: z.string().max(13, 'เลขประจำตัวผู้เสียภาษีต้องไม่เกิน 13 หลัก').optional().nullable(),
    notes: z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร').optional().nullable(),
    // ERP fields
    region: z.string().optional().nullable(),
    groupCode: z.string().optional().nullable(),
    creditLimit: z.coerce.number().min(0, 'วงเงินเครดิตต้องไม่ติดลบ').optional().nullable(),
    creditTerm: z.coerce.number().int().min(0, 'ระยะเวลาเครดิตต้องไม่ติดลบ').optional().nullable(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function getCustomerFormDefaults(customer?: any): CustomerFormValues {
    return {
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        address: customer?.address ?? '',
        taxId: customer?.taxId ?? '',
        notes: customer?.notes ?? '',
        region: customer?.region ?? null,
        groupCode: customer?.groupCode ?? null,
        creditLimit: customer?.creditLimit ?? null,
        creditTerm: customer?.creditTerm ?? null,
    };
}
