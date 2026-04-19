import { toNumber } from '@/lib/money';
import type {
    Product, Sale, SaleItem, Purchase, PurchaseItem, Expense, Income, Shipment, Return, ReturnItem
} from '@prisma/client';
import type {
    SerializedProduct,
    SerializedSale,
    SerializedSaleItem,
    SerializedPurchase,
    SerializedPurchaseItem,
    SerializedExpense,
    SerializedIncome,
    SerializedShipment,
    SerializedReturn,
    SerializedReturnItem
} from '@/types/serialized';

// ─── Constants ──────────────────────────────────────────────────────────────

/** ERP Financial Constants to avoid magic numbers */
export const FINANCE_CONSTANTS = {
    VAT_RATE: 0.07,          // 7% VAT
    TAX_INCLUSIVE_DIVISOR: 1.07,
} as const;

// ─── Mappers ────────────────────────────────────────────────────────────────

/**
 * Proper mapping for Income (removes 'as any')
 */
export function serializeIncome(income: Income): SerializedIncome {
    return {
        ...income,
        amount: toNumber(income.amount),
    };
}

/**
 * Proper mapping for Expense (removes 'as any')
 */
export function serializeExpense(expense: Expense): SerializedExpense {
    return {
        ...expense,
        amount: toNumber(expense.amount),
    };
}

/**
 * Proper mapping for Product (removes 'as any')
 */
export function serializeProduct(product: Product): SerializedProduct {
    return {
        ...product,
        costPrice: toNumber(product.costPrice),
        salePrice: toNumber(product.salePrice),
        packagingQty: product.packagingQty || 1,
    };
}

/**
 * Proper mapping for Sale (removes 'as any')
 */
export function serializeSale(sale: Sale): SerializedSale {
    return {
        ...sale,
        totalAmount: toNumber(sale.totalAmount),
        totalCost: toNumber(sale.totalCost),
        profit: toNumber(sale.profit),
        discountAmount: toNumber(sale.discountAmount),
        discountValue: sale.discountValue ? toNumber(sale.discountValue) : null,
        netAmount: toNumber(sale.netAmount),
    };
}

/**
 * Proper mapping for SaleItem (removes 'as any')
 */
export function serializeSaleItem(item: SaleItem): SerializedSaleItem {
    return {
        ...item,
        salePrice: toNumber(item.salePrice),
        costPrice: toNumber(item.costPrice),
        subtotal: toNumber(item.subtotal),
        profit: toNumber(item.profit),
        discountAmount: toNumber(item.discountAmount),
    };
}

/**
 * Proper mapping for Purchase (removes 'as any')
 */
export function serializePurchase(purchase: Purchase): SerializedPurchase {
    return {
        ...purchase,
        totalCost: toNumber(purchase.totalCost),
    };
}

/**
 * Proper mapping for PurchaseItem (removes 'as any')
 */
export function serializePurchaseItem(item: PurchaseItem): SerializedPurchaseItem {
    return {
        ...item,
        costPrice: toNumber(item.costPrice),
        subtotal: toNumber(item.subtotal),
    };
}

/**
 * Proper mapping for Shipment (removes 'as any')
 */
export function serializeShipment(shipment: Shipment): SerializedShipment {
    return {
        ...shipment,
        shippingCost: shipment.shippingCost ? toNumber(shipment.shippingCost) : null,
    };
}

/**
 * Proper mapping for Return (removes 'as any')
 */
export function serializeReturn(ret: Return): SerializedReturn {
    return {
        ...ret,
        refundAmount: toNumber(ret.refundAmount),
    };
}

/**
 * Proper mapping for ReturnItem (removes 'as any')
 */
export function serializeReturnItem(item: ReturnItem): SerializedReturnItem {
    return {
        ...item,
        refundPerUnit: toNumber(item.refundPerUnit),
        refundAmount: toNumber(item.refundAmount),
    };
}
