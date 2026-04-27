import { BaseQueryParams } from '@/types/common';
import { OrderRequestStatus } from '../sales/sales.types';

export const PurchaseType = {
    LOCAL: 'LOCAL',
    FOREIGN: 'FOREIGN',
} as const;

export type PurchaseType = (typeof PurchaseType)[keyof typeof PurchaseType];

export const PurchaseStatus = {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    ORDERED: 'ORDERED',
    RECEIVED: 'RECEIVED',
    PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
    CANCELLED: 'CANCELLED',
    ACTIVE: 'ACTIVE',
} as const;

export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

export interface GetPurchasesParams extends BaseQueryParams {
    paymentMethod?: string;
    supplierId?: string;
    status?: string;
}

export interface GetIncompletePurchasesParams extends BaseQueryParams {
    status?: string;
}

export interface CreateOrderRequestInput {
    requesterId: string;
    notes?: string;
    items: Array<{
        productId?: string;
        description?: string;
        quantity: number;
        uom?: string;
    }>;
}

export interface GetOrderRequestsParams extends BaseQueryParams {
    requesterId?: string;
    status?: OrderRequestStatus;
}

export interface GetSuppliersParams extends BaseQueryParams {
    groupCode?: string;
}

export interface CreatePurchaseReceiptInput {
    purchaseId: string;
    receivedDate?: Date;
    notes?: string;
    lineItems: Array<{
        purchaseItemId: string;
        productId: string;
        receivedQuantity: number;
        warehouseId: string;
    }>;
}
