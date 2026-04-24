import * as z from 'zod';

export const taxCodeSchema = z.object({
    code: z.string().min(1, 'กรุณาระบุรหัสผังภาษี').max(20, 'รหัสยาวเกินไป'),
    name: z.string().min(1, 'กรุณาระบุชื่อผังภาษี'),
    description: z.string().optional(),
    direction: z.enum(['OUTPUT', 'INPUT']),
    kind: z.enum(['VAT', 'ZERO_RATED', 'EXEMPT', 'NO_VAT']),
    rate: z.coerce.number().min(0, 'อัตราภาษีห้ามติดลบ'),
    calculationMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).default('EXCLUSIVE'),
    effectiveFrom: z.date(),
    effectiveTo: z.date().optional().nullable(),
    reportBucket: z.string().optional(),
    isActive: z.boolean().default(true),
});

export type TaxCodeFormValues = z.infer<typeof taxCodeSchema>;

export function getDefaultTaxCodeValues(data?: Partial<TaxCodeFormValues>): TaxCodeFormValues {
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

export const companyTaxProfileSchema = z.object({
    isVatRegistered: z.boolean().default(false),
    legalName: z.string().min(1, 'กรุณาระบุชื่อนิติบุคคล'),
    taxPayerId: z.string().optional(),
    branchCode: z.string().default('00000'),
    registeredAddress: z.string().optional(),
    vatRegistrationDate: z.date().optional().nullable(),
    vatThreshold: z.coerce.number().default(1800000),
    defaultSalesTaxCode: z.string().optional(),
    defaultPurchaseTaxCode: z.string().optional(),
    taxInvoicePrefix: z.string().default('TIV'),
    creditNotePrefix: z.string().default('CN'),
    debitNotePrefix: z.string().default('DN'),
    isTaxInvoiceFull: z.boolean().default(true),
    authorizedPerson: z.string().optional(),
    authorizedPosition: z.string().optional(),
});

export type CompanyTaxProfileValues = z.infer<typeof companyTaxProfileSchema>;

export function getDefaultCompanyTaxValues(data?: any): CompanyTaxProfileValues {
    return {
        isVatRegistered: data?.isVatRegistered ?? false,
        legalName: data?.legalName || '',
        taxPayerId: data?.taxPayerId || '',
        branchCode: data?.branchCode || '00000',
        registeredAddress: data?.registeredAddress || '',
        vatRegistrationDate: data?.vatRegistrationDate ? new Date(data.vatRegistrationDate) : null,
        vatThreshold: data?.vatThreshold ?? 1800000,
        defaultSalesTaxCode: data?.defaultSalesTaxCode || '',
        defaultPurchaseTaxCode: data?.defaultPurchaseTaxCode || '',
        taxInvoicePrefix: data?.taxInvoicePrefix || 'TIV',
        creditNotePrefix: data?.creditNotePrefix || 'CN',
        debitNotePrefix: data?.debitNotePrefix || 'DN',
        isTaxInvoiceFull: data?.isTaxInvoiceFull ?? true,
        authorizedPerson: data?.authorizedPerson || '',
        authorizedPosition: data?.authorizedPosition || '',
    };
}
