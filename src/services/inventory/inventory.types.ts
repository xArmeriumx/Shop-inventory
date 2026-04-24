import { BaseQueryParams } from '@/types/common';

export interface GetProductsParams extends BaseQueryParams {
    category?: string;
    lowStockOnly?: boolean;
}

export interface BatchProductInput {
    name: string;
    sku?: string | null;
    category: string;
    costPrice: number;
    salePrice: number;
    stock?: number;
    minStock?: number;
}

export interface BatchCreateResult {
    success: boolean;
    created: Array<{ id: string; name: string; costPrice: number }>;
    failed: Array<{ name: string; error: string }>;
}

export interface StockAvailability {
    onHand: number;
    reserved: number;
    available: number;
    isLowStock: boolean;
    minStock: number;
}

export const StockMovement = {
    SALE: 'SALE',
    PURCHASE: 'PURCHASE',
    ADJUSTMENT: 'ADJUSTMENT',
    RETURN: 'RETURN',
    WASTE: 'WASTE',
    CANCEL: 'CANCEL',
    SALE_CANCEL: 'SALE_CANCEL',
    PURCHASE_CANCEL: 'PURCHASE_CANCEL',
    RESERVATION: 'RESERVATION',
    RELEASE: 'RELEASE',
    STOCK_TAKE_RECONCILIATION: 'STOCK_TAKE_RECONCILIATION',
} as const;

export type StockMovement = (typeof StockMovement)[keyof typeof StockMovement];

export interface InventoryHealthMetrics {
    productId: string;
    productName: string;
    sku: string | null;
    avgDailySales: number;
    avgLeadTimeDays: number;
    reorderPoint: number;
    availableQty: number;
    incomingQty: number;
    healthStatus: 'HEALTHY' | 'REORDER' | 'CRITICAL';
}

export interface ReorderSuggestion {
    productId: string;
    suggestedQty: number;
    suggestedSupplierId?: string | null;
    reason: string;
}

export interface CreateDeliveryOrderInput {
    saleId: string;
    scheduledDate?: Date;
    notes?: string;
    items: Array<{
        productId: string;
        quantity: number;
    }>;
}

export interface GetDeliveryOrdersParams extends BaseQueryParams {
    status?: string;
    saleId?: string;
}

export interface AdjustStockInput {
    type: 'ADD' | 'REMOVE' | 'SET';
    quantity: number;
    description: string;
}
