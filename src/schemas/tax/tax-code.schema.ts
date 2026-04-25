import { z } from 'zod';

/**
 * Single Source of Truth for Tax Code Logic
 */

export const taxCodeSchema = z.object({
    code: z.string().min(1, 'กรุณาระบุรหัสผังภาษี').max(20, 'รหัสยาวเกินไป'),
    name: z.string().min(1, 'กรุณาระบุชื่อผังภาษี'),
    description: z.string().optional().nullable(),
    direction: z.enum(['OUTPUT', 'INPUT'], {
        errorMap: () => ({ message: 'กรุณาเลือกประเภทภาษี (ขาย/ซื้อ)' }),
    }),
    kind: z.enum(['VAT', 'ZERO_RATED', 'EXEMPT', 'NO_VAT'], {
        errorMap: () => ({ message: 'กรุณาเลือกชนิดภาษี' }),
    }),
    rate: z.coerce.number().min(0, 'อัตราภาษีห้ามติดลบ'),
    calculationMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).default('EXCLUSIVE'),
    effectiveFrom: z.coerce.date({
        errorMap: () => ({ message: 'กรุณาระบุวันที่เริ่มมีผลที่ถูกต้อง' }),
    }),
    effectiveTo: z.coerce.date().optional().nullable(),
    reportBucket: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
});

export type TaxCodeInput = z.infer<typeof taxCodeSchema>;

/**
 * Default Values Helper
 */
export function getDefaultTaxCodeValues(data?: Partial<TaxCodeInput>): TaxCodeInput {
    return {
        code: data?.code || '',
        name: data?.name || '',
        description: data?.description || '',
        direction: data?.direction || 'OUTPUT',
        kind: data?.kind || 'VAT',
        rate: data?.rate ?? 7,
        calculationMode: data?.calculationMode || 'EXCLUSIVE',
        effectiveFrom: data?.effectiveFrom || new Date(),
        effectiveTo: data?.effectiveTo || null,
        reportBucket: data?.reportBucket || '',
        isActive: data?.isActive ?? true,
    };
}

/**
 * Server-side update schema (Partial but keeps code identification)
 */
export const updateTaxCodeSchema = taxCodeSchema.partial().extend({
    // แม้จะ partial แต่ถ้าส่งมาต้องถูกกฎ
});
