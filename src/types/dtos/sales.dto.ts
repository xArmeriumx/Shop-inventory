import { SaleStatus, DocPaymentStatus } from '@/types/domain';

export interface SaleListDTO {
    id: string;
    invoiceNumber: string;
    date: Date;
    customerName: string | null;
    customerAddress?: string | null;
    customerPhone?: string | null;
    customerTaxId?: string | null;
    status: SaleStatus;
    paymentStatus: DocPaymentStatus;
    paymentMethod: string;
    netAmount: number;
    profit?: number;
}

export interface SaleDetailDTO extends SaleListDTO {
    notes: string | null;
    paymentMethod: string;
    channel: string;
    discountAmount: number;
    taxAmount: number;
    taxableAmount: number;
    totalAmount: number;
    paidAmount: number;
    residualAmount: number;
    items: SaleItemDTO[];
    // Sensitive fields (filtered by permission)
    totalCost?: number;
    profit?: number;
}

export interface SaleItemDTO {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
    // Sensitive fields
    costPrice?: number;
    profit?: number;
}
