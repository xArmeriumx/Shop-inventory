import { BaseQueryParams } from '@/types/common';

export interface GetFinanceParams extends BaseQueryParams {
    category?: string;
}

export const BillingStatus = {
    UNBILLED: 'UNBILLED',
    BILLED: 'BILLED',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
} as const;

export type BillingStatus = (typeof BillingStatus)[keyof typeof BillingStatus];

export const TaxType = {
    NONE: 'NONE',
    VAT7: 'VAT7',
    WHT1: 'WHT1',
    WHT3: 'WHT3',
    WHT5: 'WHT5',
} as const;

export type TaxType = (typeof TaxType)[keyof typeof TaxType];

export const ClaimStatus = {
    CLAIMABLE: 'CLAIMABLE',
    WAITING_DOC: 'WAITING_DOC',
    NON_CLAIMABLE: 'NON_CLAIMABLE',
} as const;

export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const PurchaseTaxStatus = {
    DRAFT: 'DRAFT',
    POSTED: 'POSTED',
    VOIDED: 'VOIDED',
} as const;

export type PurchaseTaxStatus = (typeof PurchaseTaxStatus)[keyof typeof PurchaseTaxStatus];

export const PurchaseTaxSourceType = {
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    MANUAL_EXPENSE: 'MANUAL_EXPENSE',
} as const;

export type PurchaseTaxSourceType = (typeof PurchaseTaxSourceType)[keyof typeof PurchaseTaxSourceType];
