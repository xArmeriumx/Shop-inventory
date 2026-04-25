import { BaseQueryParams } from '@/types/common';
import { PurchaseType } from '../purchases/purchases.types';

export const DocumentType = {
    SALE_INVOICE: 'INV',
    SALE_ORDER: 'SO',
    PURCHASE_ORDER: 'PO',
    PURCHASE_REQUEST: 'PR',
    SHIPMENT: 'SHP',
    RETURN: 'RET',
    CREDIT_NOTE: 'CN',
    QUOTATION: 'QT',
    BILLING: 'BIL',
    ORDER_REQUEST: 'OR',
    DELIVERY_ORDER: 'DO',
    PURCHASE_TAX: 'PTX',
    WHT_CERTIFICATE: 'WHT',
    JOURNAL_VOUCHER: 'JV',
    PAYMENT: 'RCP',
    STOCK_TRANSFER: 'ST',
    PURCHASE_RETURN: 'DBN',
} as const;

export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const ApprovalStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export interface SubmitApprovalInput {
    documentType: string;
    documentId: string;
    approverUserIds: string[];
}

export interface ApprovalActionInput {
    approvalInstanceId?: string;
    documentType?: string;
    documentId?: string;
    action: 'APPROVE' | 'REJECT';
    reason?: string;
}

export const SequenceFormat = {
    STANDARD: 'STANDARD',
    WITH_DEPT: 'WITH_DEPT',
    THAI_YEAR: 'THAI_YEAR',
} as const;

export type SequenceFormat = (typeof SequenceFormat)[keyof typeof SequenceFormat];

export interface SequenceConfig {
    documentType: DocumentType;
    format: SequenceFormat;
    prefix?: string;
    departmentCode?: string;
    purchaseType?: PurchaseType;
    resetCycle: 'MONTHLY' | 'YEARLY' | 'NEVER';
    padLength: number;
    useBuddhistYear: boolean;
}

export const ShipmentStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    RETURNED: 'RETURNED',
    CANCELLED: 'CANCELLED',
} as const;

export type ShipmentStatus = (typeof ShipmentStatus)[keyof typeof ShipmentStatus];

export const DeliveryStatus = {
    DRAFT: 'DRAFT',
    WAITING: 'WAITING',
    PROCESSING: 'PROCESSING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
    PENDING: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED', 'RETURNED'],
    DELIVERED: [],
    RETURNED: ['PROCESSING', 'CANCELLED'],
    CANCELLED: ['PENDING'],
};

export interface CreateShipmentInput {
    saleId: string;
    recipientName: string;
    recipientPhone?: string;
    shippingAddress: string;
    partnerAddressId?: string;
    customerAddressId?: string;
    trackingNumber?: string;
    shippingProvider?: string;
    shippingCost?: number;
    notes?: string;
}

export interface GetShipmentsParams extends BaseQueryParams {
    status?: string;
    saleId?: string;
    startDate?: string;
    endDate?: string;
}

export const Region = {
    NORTH: 'NORTH',
    CENTRAL: 'CENTRAL',
    NORTHEAST: 'NORTHEAST',
    SOUTH: 'SOUTH',
    EAST: 'EAST',
    WEST: 'WEST',
    BANGKOK: 'BANGKOK',
} as const;

export type Region = (typeof Region)[keyof typeof Region];
