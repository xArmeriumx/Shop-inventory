import { z } from 'zod';
import { partnerAddressSchema } from './partner-form';

export const supplierFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อผู้จำหน่าย'),
    code: z.string().optional().nullable(),
    taxId: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email('รูปแบบอีเมลไม่ถูกต้อง').optional().or(z.literal('')).nullable(),
    notes: z.string().optional().nullable(),
    creditLimit: z.coerce.number().min(0).optional().default(0),
    creditTerm: z.coerce.number().int().min(0).optional().default(0),
    moq: z.coerce.number().min(0).optional().default(0),
    paymentTerms: z.string().optional().nullable(),
    addresses: z.array(partnerAddressSchema).optional().default([]),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export function getSupplierFormDefaults(data?: any): SupplierFormValues {
    return {
        name: data?.name || '',
        code: data?.code || '',
        taxId: data?.taxId || '',
        phone: data?.phone || '',
        email: data?.email || '',
        notes: data?.notes || '',
        creditLimit: data?.creditLimit ? Number(data.creditLimit) : 0,
        creditTerm: data?.creditTerm || 0,
        moq: data?.moq ? Number(data.moq) : 0,
        paymentTerms: data?.paymentTerms || '',
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
    };
}
