import { z } from 'zod';

/**
 * Unified Lookup Schema (Phase C Standard)
 * Used for Categories, Units, Payment Methods, etc.
 */

export const lookupValueSchema = z.object({
    name: z.string().min(1, 'กรุณาระบุชื่อหมวดหมู่').max(50, 'ชื่อยาวเกินไป'),
    color: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

export type LookupValueInput = z.infer<typeof lookupValueSchema>;

/**
 * Default Values Helper
 */
export function getDefaultLookupValues(data?: Partial<LookupValueInput>): LookupValueInput {
    return {
        name: data?.name || '',
        color: data?.color || '#6b7280',
        icon: data?.icon || null,
        order: data?.order ?? 0,
        isActive: data?.isActive ?? true,
    };
}
