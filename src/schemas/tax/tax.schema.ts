import { z } from 'zod';

/**
 * Zod Schemas for Tax Operations (Phase OB5.2)
 */

export const purchaseTaxPostSchema = z.object({
    vendorDocNo: z.string().min(1, 'กรุณาระบุเลขที่ใบกำกับภาษี'),
    vendorDocDate: z.coerce.date({
        errorMap: () => ({ message: 'กรุณาระบุวันที่ใบกำกับภาษีที่ถูกต้อง' }),
    }),
    claimStatus: z.enum(['CLAIMABLE', 'NON_CLAIMABLE', 'DEFERRED'], {
        errorMap: () => ({ message: 'กรุณาเลือกสถานะการเคลมภาษี' }),
    }),
});

export const upsertCompanyTaxProfileSchema = z.object({
    isVatRegistered: z.boolean().default(false),
    legalName: z.string().min(1, 'กรุณาระบุชื่อนิติบุคคล'),
    taxPayerId: z.string().optional(),
    branchCode: z.string().optional(),
    registeredAddress: z.string().optional(),
    vatRegistrationDate: z.coerce.date().optional(),
    vatThreshold: z.coerce.number().optional(),
    defaultSalesTaxCode: z.string().optional(),
    defaultPurchaseTaxCode: z.string().optional(),
    taxInvoicePrefix: z.string().optional(),
    creditNotePrefix: z.string().optional(),
    debitNotePrefix: z.string().optional(),
    isTaxInvoiceFull: z.boolean().optional(),
    authorizedPerson: z.string().optional(),
    authorizedPosition: z.string().optional(),
});

export const createTaxCodeSchema = z.object({
    code: z.string().min(1, 'กรุณาระบุรหัสภาษี'),
    name: z.string().min(1, 'กรุณาระบุชื่อภาษี'),
    description: z.string().optional(),
    direction: z.enum(['OUTPUT', 'INPUT']),
    kind: z.enum(['VAT', 'ZERO_RATED', 'EXEMPT', 'NO_VAT']),
    rate: z.coerce.number().min(0, 'อัตราภาษีต้องไม่ต่ำกว่า 0'),
    calculationMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional(),
    effectiveFrom: z.coerce.date({
        errorMap: () => ({ message: 'กรุณาระบุวันที่เริ่มมีผลที่ถูกต้อง' }),
    }),
    effectiveTo: z.coerce.date().optional(),
    reportBucket: z.string().optional(),
});

export const updateTaxCodeSchema = createTaxCodeSchema.partial();
