import { z } from 'zod';

/**
 * Single Source of Truth for Company Tax Profile
 */

export const upsertCompanyTaxProfileSchema = z.object({
    isVatRegistered: z.boolean().default(false),
    legalName: z.string().min(1, 'กรุณาระบุชื่อนิติบุคคล'),
    taxPayerId: z.string().optional().nullable(),
    branchCode: z.string().default('00000'),
    registeredAddress: z.string().optional().nullable(),
    vatRegistrationDate: z.coerce.date().optional().nullable(),
    vatThreshold: z.coerce.number().default(1800000),
    defaultSalesTaxCode: z.string().optional().nullable(),
    defaultPurchaseTaxCode: z.string().optional().nullable(),
    taxInvoicePrefix: z.string().default('TIV'),
    creditNotePrefix: z.string().default('CN'),
    debitNotePrefix: z.string().default('DN'),
    isTaxInvoiceFull: z.boolean().default(true),
    authorizedPerson: z.string().optional().nullable(),
    authorizedPosition: z.string().optional().nullable(),
});

export type CompanyTaxProfileInput = z.infer<typeof upsertCompanyTaxProfileSchema>;

/**
 * Default Values Helper
 */
export function getDefaultCompanyTaxValues(data?: any): CompanyTaxProfileInput {
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
