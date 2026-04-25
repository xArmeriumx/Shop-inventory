import { z } from 'zod';

/**
 * Unified Chart of Accounts Schema (Phase A1 Standard)
 */

export const AccountCategoryEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'], {
    errorMap: () => ({ message: 'กรุณาเลือกหมวดบัญชีที่ถูกต้อง' }),
});

export const NormalBalanceEnum = z.enum(['DEBIT', 'CREDIT'], {
    errorMap: () => ({ message: 'กรุณาเลือกประเภทความสมดุล (Normal Balance)' }),
});

export const accountSchema = z.object({
    code: z.string().min(1, 'กรุณาระบุรหัสผังบัญชี').max(20, 'รหัสยาวเกินไป'),
    name: z.string().min(1, 'กรุณาระบุชื่อบัญชี'),
    category: AccountCategoryEnum,
    normalBalance: NormalBalanceEnum,
    parentId: z.string().optional().nullable(),
    isPostable: z.boolean().default(true),
    isActive: z.boolean().default(true),
});

export type AccountInput = z.infer<typeof accountSchema>;

/**
 * Default Values Helper
 */
export function getDefaultAccountValues(data?: Partial<AccountInput>): AccountInput {
    return {
        code: data?.code || '',
        name: data?.name || '',
        category: data?.category || 'ASSET',
        normalBalance: data?.normalBalance || 'DEBIT',
        parentId: data?.parentId || null,
        isPostable: data?.isPostable ?? true,
        isActive: data?.isActive ?? true,
    };
}
