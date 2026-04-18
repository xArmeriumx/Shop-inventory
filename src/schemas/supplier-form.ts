/**
 * Supplier Form Schema
 * 
 * Client-side validation for react-hook-form.
 * Normalization happens in the backend supplierSchema.
 */
import { z } from 'zod';

export const supplierFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อผู้จำหน่าย').max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร'),
    code: z.string().max(50, 'รหัสต้องไม่เกิน 50 ตัวอักษร').optional().nullable(),
    contactName: z.string().max(100, 'ชื่อผู้ติดต่อต้องไม่เกิน 100 ตัวอักษร').optional().nullable(),
    phone: z.string().max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก').optional().nullable(),
    email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).optional().nullable()
        .or(z.literal('')).transform(v => v || null),
    address: z.string().max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
    taxId: z.string().max(13, 'เลขประจำตัวผู้เสียภาษีต้องไม่เกิน 13 หลัก').optional().nullable(),
    notes: z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร').optional().nullable(),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export function getSupplierFormDefaults(supplier?: any): SupplierFormValues {
    return {
        name: supplier?.name ?? '',
        code: supplier?.code ?? '',
        contactName: supplier?.contactName ?? '',
        phone: supplier?.phone ?? '',
        email: supplier?.email ?? '',
        address: supplier?.address ?? '',
        taxId: supplier?.taxId ?? '',
        notes: supplier?.notes ?? '',
    };
}
