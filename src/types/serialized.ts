import type { Product, Sale, SaleItem, Purchase, PurchaseItem, Expense, Income, Customer, Supplier } from '@prisma/client';

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
  packagingQty: number; // Ensure it exists for Rule 6.3/14.4
};

/**
 * Sale with Decimal fields converted to number
 */
export type SerializedSale = Omit<Sale, 'totalAmount' | 'totalCost' | 'profit' | 'discountAmount' | 'discountValue' | 'netAmount'> & {
  totalAmount: number;
  totalCost: number;
  profit: number;
  // G4: Discount fields
  discountAmount: number;
  discountValue: number | null;
  netAmount: number;
};

/**
 * SaleItem with Decimal fields converted to number
 */
export type SerializedSaleItem = Omit<SaleItem, 'salePrice' | 'costPrice' | 'subtotal' | 'profit' | 'discountAmount'> & {
  salePrice: number;
  costPrice: number;
  subtotal: number;
  profit: number;
  discountAmount: number;  // G4
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

/**
 * Income with Decimal field converted to number
 */
export type SerializedIncome = Omit<Income, 'amount'> & {
  amount: number;
};

/**
 * Customer with Decimal fields converted to number
 */
export type SerializedCustomer = Omit<Customer, 'creditLimit'> & {
  creditLimit: number | null;
  salesPersons?: {
    id: string;
    userId: string;
    user: { name: string | null; email: string | null };
    departmentCode: string | null;
  }[];
};

/**
 * Supplier with Decimal fields converted to number
 */
export type SerializedSupplier = Omit<Supplier, 'moq'> & {
  moq: number | null;
};

// ============================================================================
// Extended Types (with relations)
// ============================================================================

/**
 * SerializedSale with basic customer info for list views
 */
export type SerializedSaleListItem = SerializedSale & {
  customer: {
    name: string;
  } | null;
};

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
    phone?: string | null;
    address?: string | null;
    taxId?: string | null;
  } | null;
};
