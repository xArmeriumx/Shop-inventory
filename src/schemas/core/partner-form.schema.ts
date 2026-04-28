import { z } from 'zod';

/**
 * Centered DTOs for Partner Infrastructure (Rule 8)
 */

export const partnerContactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อ').max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
    phone: z.string().max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก').optional().nullable(),
    email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).optional().nullable().or(z.literal('')),
    position: z.string().max(100, 'ตำแหน่งต้องไม่เกิน 100 ตัวอักษร').optional().nullable(),
    isPrimary: z.boolean().default(false),
});

export const partnerAddressSchema = z.object({
    id: z.string().optional(),
    clientKey: z.string().optional(), // Rule 5: Stable key for useFieldArray
    label: z.string().min(1, 'กรุณากรอกชื่อเรียกที่อยู่ (เช่น สำนักงานใหญ่)').max(100),
    addressLine: z.string().min(1, 'กรุณากรอกที่อยู่').max(500),
    subDistrict: z.string().max(100).optional().nullable(), // ตำบล/แขวง
    district: z.string().max(100).optional().nullable(),     // อำเภอ/เขต
    province: z.string().max(100).optional().nullable(),     // จังหวัด
    postalCode: z.string().max(5, 'รหัสไปรษณีย์ต้องมี 5 หลัก').optional().nullable(),
    country: z.string().default('Thailand'),
    isDefaultBilling: z.boolean().default(false),
    isDefaultShipping: z.boolean().default(false),
    type: z.enum(['BILLING', 'SHIPPING', 'BOTH', 'OTHER']).default('BOTH'),
    contacts: z.array(partnerContactSchema).default([]),
});

export type PartnerContactInput = z.infer<typeof partnerContactSchema>;
export type PartnerAddressInput = z.infer<typeof partnerAddressSchema>;

/**
 * Default Address Logic (Rule 4)
 * Ensures only one billing and one shipping default exists.
 */
export function validatePartnerDefaults(addresses: PartnerAddressInput[]) {
    const billingDefaults = addresses.filter(a => a.isDefaultBilling);
    const shippingDefaults = addresses.filter(a => a.isDefaultShipping);

    if (billingDefaults.length > 1) return 'สามารถเลือกที่อยู่เริ่มต้นสำหรับการวางบิลได้เพียงที่เดียว';
    if (shippingDefaults.length > 1) return 'สามารถเลือกที่อยู่เริ่มต้นสำหรับการจัดส่งได้เพียงที่เดียว';

    return null;
}
