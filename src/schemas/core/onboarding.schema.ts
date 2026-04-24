/**
 * ============================================================================
 * Onboarding Form Schemas (Zod) — Phase OB1
 * ============================================================================
 * Validation rules for all 5 Genesis Wizard steps.
 * These are the SINGLE SOURCE OF TRUTH for field constraints.
 *
 * Key rules:
 * - vatRegistered=true → taxId + branchCode + address are required (conditional)
 * - Server Actions must re-validate with these same schemas (not just client)
 * - getDefaultValues() functions are co-located here (not in components)
 */
import { z } from 'zod';
import { IndustryType, OnboardingMode, RoleTemplate } from '@/types/onboarding.types';
import { sanitizeText } from '@/lib/sanitize';

// ============================================================================
// Step 1: Business Identity
// ============================================================================

export const genesisStep1Schema = z.object({
    name: z
        .string()
        .min(1, 'กรุณากรอกชื่อกิจการ')
        .max(200, 'ชื่อกิจการต้องไม่เกิน 200 ตัวอักษร')
        .transform((v) => sanitizeText(v)),

    industryType: z.enum(
        Object.values(IndustryType) as [string, ...string[]],
        { errorMap: () => ({ message: 'กรุณาเลือกประเภทธุรกิจ' }) }
    ),

    phone: z
        .string()
        .min(1, 'กรุณากรอกเบอร์โทรศัพท์')
        .max(10, 'เบอร์โทรต้องไม่เกิน 10 หลัก')
        .regex(/^[0-9]+$/, 'เบอร์โทรต้องเป็นตัวเลขเท่านั้น'),

    logo: z.string().url('URL โลโก้ไม่ถูกต้อง').optional().nullable(),
});

export type GenesisStep1Input = z.infer<typeof genesisStep1Schema>;

export function getStep1Defaults(data?: Partial<GenesisStep1Input>): GenesisStep1Input {
    return {
        name: data?.name ?? '',
        industryType: data?.industryType ?? IndustryType.RETAIL,
        phone: data?.phone ?? '',
        logo: data?.logo ?? null,
    };
}

// ============================================================================
// Step 2: Legal & Tax Setup (with Conditional VAT Validation)
// ============================================================================

export const genesisStep2Schema = z
    .object({
        isVatRegistered: z.boolean().default(false),

        taxId: z
            .string()
            .max(13, 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก')
            .regex(/^[0-9]*$/, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลขเท่านั้น')
            .optional()
            .nullable()
            .transform((v) => v?.trim() || null),

        branchCode: z
            .string()
            .max(5, 'รหัสสาขาต้องไม่เกิน 5 หลัก')
            .optional()
            .nullable()
            .transform((v) => v?.trim() || null),

        address: z
            .string()
            .max(500, 'ที่อยู่ต้องไม่เกิน 500 ตัวอักษร')
            .optional()
            .nullable()
            .transform((v) => v ? sanitizeText(v) : null),

        legalEntityName: z
            .string()
            .max(200, 'ชื่อนิติบุคคลต้องไม่เกิน 200 ตัวอักษร')
            .optional()
            .nullable()
            .transform((v) => v ? sanitizeText(v) : null),
    })
    .superRefine((data, ctx) => {
        // Conditional VAT validation — if VAT registered, tax fields become mandatory
        if (data.isVatRegistered) {
            if (!data.taxId || data.taxId.length !== 13) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['taxId'],
                    message: 'กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลัก (จำเป็นสำหรับผู้จดทะเบียน VAT)',
                });
            }
            if (!data.address) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['address'],
                    message: 'กรุณากรอกที่อยู่จดทะเบียน (จำเป็นสำหรับผู้จดทะเบียน VAT)',
                });
            }
            if (!data.branchCode) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['branchCode'],
                    message: 'กรุณากรอกรหัสสาขา (ใส่ 00000 หากเป็นสำนักงานใหญ่)',
                });
            }
        }
    });

export type GenesisStep2Input = z.infer<typeof genesisStep2Schema>;

export function getStep2Defaults(data?: Partial<GenesisStep2Input>): GenesisStep2Input {
    return {
        isVatRegistered: data?.isVatRegistered ?? false,
        taxId: data?.taxId ?? null,
        branchCode: data?.branchCode ?? '00000',
        address: data?.address ?? null,
        legalEntityName: data?.legalEntityName ?? null,
    };
}

// ============================================================================
// Step 3: Financial & Banking Defaults
// ============================================================================

export const genesisStep3Schema = z.object({
    defaultCurrency: z.string().default('THB'),

    invoicePrefix: z
        .string()
        .min(1, 'กรุณากรอก Prefix')
        .max(10, 'Prefix ต้องไม่เกิน 10 ตัวอักษร')
        .regex(/^[A-Z0-9-]+$/, 'Prefix ต้องเป็นตัวอักษรพิมพ์ใหญ่หรือตัวเลขเท่านั้น')
        .default('INV'),

    paymentMethods: z
        .array(z.enum(['CASH', 'TRANSFER', 'CREDIT']))
        .min(1, 'กรุณาเลือกวิธีชำระเงินอย่างน้อย 1 วิธี'),

    fiscalYearStart: z
        .number()
        .int()
        .min(1, 'เดือนที่ 1–12')
        .max(12, 'เดือนที่ 1–12')
        .default(1),

    promptPayId: z
        .string()
        .max(20, 'PromptPay ID ต้องไม่เกิน 20 ตัวอักษร')
        .optional()
        .nullable(),

    defaultAccountName: z
        .string()
        .min(1, 'กรุณากรอกชื่อบัญชี')
        .max(100, 'ชื่อบัญชีต้องไม่เกิน 100 ตัวอักษร'),

    defaultAccountType: z.enum(['CASH', 'BANK']).default('CASH'),

    defaultBankName: z
        .string()
        .max(100, 'ชื่อธนาคารต้องไม่เกิน 100 ตัวอักษร')
        .optional()
        .nullable(),
});

export type GenesisStep3Input = z.infer<typeof genesisStep3Schema>;

export function getStep3Defaults(data?: Partial<GenesisStep3Input>): GenesisStep3Input {
    return {
        defaultCurrency: data?.defaultCurrency ?? 'THB',
        invoicePrefix: data?.invoicePrefix ?? 'INV',
        paymentMethods: data?.paymentMethods ?? ['CASH', 'TRANSFER'],
        fiscalYearStart: data?.fiscalYearStart ?? 1,
        promptPayId: data?.promptPayId ?? null,
        defaultAccountName: data?.defaultAccountName ?? 'เงินสด',
        defaultAccountType: data?.defaultAccountType ?? 'CASH',
        defaultBankName: data?.defaultBankName ?? null,
    };
}

// ============================================================================
// Step 4: Team & Roles
// ============================================================================

export const genesisStep4Schema = z.object({
    roleTemplate: z.enum(
        Object.values(RoleTemplate) as [string, ...string[]],
        { errorMap: () => ({ message: 'กรุณาเลือก Role Template' }) }
    ).default(RoleTemplate.SKIP),

    inviteEmail: z
        .string()
        .email('อีเมลไม่ถูกต้อง')
        .optional()
        .nullable()
        .transform((v) => v?.trim() || null),
});

export type GenesisStep4Input = z.infer<typeof genesisStep4Schema>;

export function getStep4Defaults(data?: Partial<GenesisStep4Input>): GenesisStep4Input {
    return {
        roleTemplate: data?.roleTemplate ?? RoleTemplate.SKIP,
        inviteEmail: data?.inviteEmail ?? null,
    };
}

// ============================================================================
// Step 5: Starting Data
// ============================================================================

export const genesisStep5Schema = z.object({
    onboardingMode: z.enum(
        Object.values(OnboardingMode) as [string, ...string[]],
        { errorMap: () => ({ message: 'กรุณาเลือกวิธีเริ่มต้น' }) }
    ).default(OnboardingMode.EMPTY),

    importFileUrl: z
        .string()
        .url('URL ไฟล์ไม่ถูกต้อง')
        .optional()
        .nullable(),
});

export type GenesisStep5Input = z.infer<typeof genesisStep5Schema>;

export function getStep5Defaults(data?: Partial<GenesisStep5Input>): GenesisStep5Input {
    return {
        onboardingMode: data?.onboardingMode ?? OnboardingMode.EMPTY,
        importFileUrl: data?.importFileUrl ?? null,
    };
}

// ============================================================================
// Complete Genesis Payload type — intersection of all 5 step types
// ============================================================================
// Note: genesisStep2Schema uses superRefine() which produces ZodEffects (not ZodObject).
// ZodEffects does not support .merge(), so we use TypeScript intersection instead.
// The union type is equivalent for component prop-typing and action signatures.
export type GenesisCompleteInput =
    GenesisStep1Input &
    GenesisStep2Input &
    GenesisStep3Input &
    GenesisStep4Input &
    GenesisStep5Input;
