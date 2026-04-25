import { BaseQueryParams } from '@/types/common';

export const SaleStatus = {
    DRAFT: 'DRAFT',
    CONFIRMED: 'CONFIRMED',
    INVOICED: 'INVOICED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    ACTIVE: 'ACTIVE',
} as const;

export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const BookingStatus = {
    NONE: 'NONE',
    RESERVED: 'RESERVED',
    DEDUCTED: 'DEDUCTED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const EditLockStatus = {
    UNLOCKED: 'UNLOCKED',
    LOCKED: 'LOCKED',
} as const;

export type EditLockStatus = (typeof EditLockStatus)[keyof typeof EditLockStatus];

export const DocPaymentStatus = {
    UNPAID: 'UNPAID',
    PARTIAL: 'PARTIAL',
    PAID: 'PAID',
    VOIDED: 'VOIDED',
} as const;

export type DocPaymentStatus = (typeof DocPaymentStatus)[keyof typeof DocPaymentStatus];

export const QuotationStatus = {
    DRAFT: 'DRAFT',
    SENT: 'SENT',
    CONFIRMED: 'CONFIRMED',
    CANCELLED: 'CANCELLED',
} as const;

export type QuotationStatus = (typeof QuotationStatus)[keyof typeof QuotationStatus];

export const OrderRequestStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    APPROVED: 'APPROVED',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
    CANCELLED: 'CANCELLED',
} as const;

export type OrderRequestStatus = (typeof OrderRequestStatus)[keyof typeof OrderRequestStatus];

export interface GetSalesParams extends BaseQueryParams {
    paymentMethod?: string;
    channel?: string;
    status?: SaleStatus;
    customerId?: string;
    salesFlowMode?: 'RETAIL' | 'ERP';
}

export interface GetQuotationsParams extends BaseQueryParams {
    customerId?: string;
    status?: QuotationStatus;
}

export interface GetCustomersParams extends BaseQueryParams {
    region?: string;
    groupCode?: string;
}

export interface CreateQuotationInput {
    customerId: string;
    salespersonId?: string;
    date?: Date;
    validUntil?: Date;
    currencyCode?: string;
    notes?: string;
    items: Array<{
        productId: string;
        description?: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
    }>;
}

export interface GetInvoicesParams extends BaseQueryParams {
    saleId?: string;
    customerId?: string;
    status?: string;
    partnerAddress?: string;
}

export interface CreateInvoiceInput {
    saleId?: string;
    customerId?: string;
    date?: Date;
    dueDate?: Date;
    currencyCode?: string;
    notes?: string;
    items: Array<{
        productId: string;
        description?: string;
        quantity: number;
        unitPrice: number;
    }>;
}
