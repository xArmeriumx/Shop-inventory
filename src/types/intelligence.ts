import { StockMovementType } from '@prisma/client';

/**
 * Normalized DTO for Stock Movement History
 * Decouples the UI from internal Prisma relations
 */
export interface StockMovementDTO {
    id: string;
    type: StockMovementType;
    date: Date | string;
    quantity: number;        // Change in qty (can be +/-)
    balance: number;         // Snapshot after movement

    // Source Document Linkage (Rule 4: Traceability)
    referenceType: 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT' | 'STOCK_TAKE' | 'DELIVERY' | 'INITIAL' | 'UNKNOWN';
    referenceId?: string;
    referenceNo?: string;    // Human readable code e.g. "DO-001", "PO-005"

    actorName: string;
    note?: string;
}

/**
 * Product Intelligence Summary for Cards (Rule 5)
 */
export interface ProductIntelligenceSummary {
    productId: string;
    onHand: number;
    reserved: number;
    available: number;

    currentWac: number;      // Rule 2: Consistent with costing
    latestCost: number;
    latestSalePrice: number;

    lastMovementDate?: Date | string;
}

/**
 * Supplier Intelligence DTO for Vendor Context
 */
export interface SupplierIntelligenceDTO {
    id: string;
    supplierId: string;
    supplierName: string;

    vendorSku?: string;
    moq?: number;
    leadTime?: number;
    vendorPrice?: number;

    isPreferred?: boolean;
    notes?: string;

    lastPurchasedDate?: Date | string;
    lastPurchasePrice?: number;
}

/**
 * Paginated Result Wrapper
 */
export interface PaginatedIntelligence<T> {
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}
