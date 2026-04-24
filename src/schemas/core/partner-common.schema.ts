import { z } from 'zod';

export const partnerContactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'กรุณากรอกชื่อผู้ติดต่อ').max(200),
    position: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    lineId: z.string().optional().nullable(),
    isPrimary: z.boolean().default(false),
    notes: z.string().optional().nullable(),
});

export const partnerAddressSchema = z.object({
    id: z.string().optional(),
    label: z.string().optional().nullable(),
    recipientName: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    address: z.string().min(1, 'กรุณากรอกที่อยู่'),
    district: z.string().optional().nullable(),
    subDistrict: z.string().optional().nullable(),
    province: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
    taxId: z.string().optional().nullable(),
    isDefaultBilling: z.boolean().default(false),
    isDefaultShipping: z.boolean().default(false),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    contacts: z.array(partnerContactSchema).optional().default([]),
});
