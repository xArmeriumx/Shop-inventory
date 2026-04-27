/**
 * Settings Form Schemas
 */
import { z } from 'zod';

// Profile Schema
export const profileFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อ').max(100, 'ชื่อต้องไม่เกิน 100 ตัวอักษร'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function getProfileFormDefaults(user?: any): ProfileFormValues {
    return {
        name: user?.name ?? '',
    };
}

// Shop Schema
export const shopFormSchema = z.object({
    name: z.string().min(1, 'กรุณากรอกชื่อร้าน').max(200, 'ชื่อร้านต้องไม่เกิน 200 ตัวอักษร'),
    phone: z.string().max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก').optional().nullable(),
    address: z.string().max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร').optional().nullable(),
    taxId: z.string().max(13, 'เลขประจำตัวผู้เสียภาษีต้องไม่เกิน 13 หลัก').optional().nullable(),
    promptPayId: z.string().max(20, 'PromptPay ID ต้องไม่เกิน 20 หลัก').optional().nullable(),
    logo: z.string().optional().nullable(),
    inventoryMode: z.enum(['SIMPLE', 'SINGLE', 'MULTI']).default('SIMPLE'),
});

export type ShopFormValues = z.infer<typeof shopFormSchema>;

export function getShopFormDefaults(shop?: any): ShopFormValues {
    return {
        name: shop?.name ?? '',
        phone: shop?.phone ?? '',
        address: shop?.address ?? '',
        taxId: shop?.taxId ?? '',
        promptPayId: shop?.promptPayId ?? '',
        logo: shop?.logo ?? '',
        inventoryMode: shop?.inventoryMode ?? 'SIMPLE',
    };
}
