import { z } from 'zod';
import { partnerAddressSchema } from './partner-form';

export const customerFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อลูกค้า').max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร'),
    phone: z.string().max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก').optional().nullable(),
    email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').max(254).optional().nullable()
        .or(z.literal('')).transform(v => v || null),
    taxId: z.string().max(13, 'เลขประจำตัวผู้เสียภาษีต้องไม่เกิน 13 หลัก').optional().nullable(),
    notes: z.string().max(1000, 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร').optional().nullable(),
    // ERP fields
    region: z.string().optional().nullable(),
    groupCode: z.string().optional().nullable(),
    creditLimit: z.coerce.number().min(0, 'วงเงินเครดิตต้องไม่ติดลบ').optional().nullable(),
    creditTerm: z.coerce.number().int().min(0, 'ระยะเวลาเครดิตต้องไม่ติดลบ').optional().nullable(),

    // Rule 2 & 3: Multi-address support
    addresses: z.array(partnerAddressSchema).min(0),

    // UI logic fields
    sameAsShipping: z.boolean().optional(),
    billingAddress: z.string().optional(),
    shippingAddress: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function getCustomerFormDefaults(data?: any): CustomerFormValues {
    return {
        name: data?.name || '',
        phone: data?.phone || '',
        email: data?.email || '',
        taxId: data?.taxId || '',
        region: data?.region || '',
        groupCode: data?.groupCode || '',
        notes: data?.notes || '',
        creditLimit: data?.creditLimit ? Number(data.creditLimit) : 0,
        creditTerm: data?.creditTerm || 0,
        addresses: data?.addresses?.map((addr: any) => ({
            id: addr.id,
            label: addr.label || '',
            addressLine: addr.addressLine || '',
            district: addr.district || '',
            province: addr.province || '',
            type: addr.type || 'BOTH',
            isDefaultBilling: !!addr.isDefaultBilling,
            isDefaultShipping: !!addr.isDefaultShipping,
            contacts: addr.contacts?.map((c: any) => ({
                id: c.id,
                name: c.name || '',
                phone: c.phone || '',
                email: c.email || '',
                isPrimary: !!c.isPrimary,
            })) || [],
        })) || [],
        sameAsShipping: false,
        billingAddress: data?.address || '',
        shippingAddress: data?.address || '',
    };
}
