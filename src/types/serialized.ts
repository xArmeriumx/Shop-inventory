import type { Product, Sale, SaleItem, Purchase, PurchaseItem, Expense } from '@prisma/client';

// ============================================================================
// Serialized Types
// 
// These types represent the shape of data AFTER serialization for client components.
// Prisma returns Decimal objects, but we convert them to numbers before sending
// to client components. These types reflect that conversion.
// ============================================================================

/**
 * Product with Decimal fields converted to number for client component compatibility
 */
export type SerializedProduct = Omit<Product, 'costPrice' | 'salePrice'> & {
  costPrice: number;
  salePrice: number;
};

/**
 * Sale with Decimal fields converted to number
 */
export type SerializedSale = Omit<Sale, 'totalAmount' | 'totalCost' | 'profit'> & {
  totalAmount: number;
  totalCost: number;
  profit: number;
};

/**
 * SaleItem with Decimal fields converted to number
 */
export type SerializedSaleItem = Omit<SaleItem, 'salePrice' | 'costPrice' | 'subtotal' | 'profit'> & {
  salePrice: number;
  costPrice: number;
  subtotal: number;
  profit: number;
};

/**
 * Purchase with Decimal fields converted to number
 */
export type SerializedPurchase = Omit<Purchase, 'totalCost'> & {
  totalCost: number;
};

/**
 * PurchaseItem with Decimal fields converted to number
 */
export type SerializedPurchaseItem = Omit<PurchaseItem, 'costPrice' | 'subtotal'> & {
  costPrice: number;
  subtotal: number;
};

/**
 * Expense with Decimal field converted to number
 */
export type SerializedExpense = Omit<Expense, 'amount'> & {
  amount: number;
};

// ============================================================================
// Extended Types (with relations)
// ============================================================================

/**
 * SerializedSale with items included
 */
export type SerializedSaleWithItems = SerializedSale & {
  items: (SerializedSaleItem & {
    product: {
      id: string;
      name: string;
      sku: string | null;
    };
  })[];
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    taxId: string | null;
  } | null;
};

/**
 * SerializedPurchase with items included
 */
export type SerializedPurchaseWithItems = SerializedPurchase & {
  items: (SerializedPurchaseItem & {
    product: {
      id?: string;
      name: string;
      sku?: string | null;
    };
  })[];
  supplier?: {
    name: string;
  } | null;
};
