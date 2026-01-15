/**
 * POS Types - Shared type definitions for POS module
 * Can be copied to a separate project if POS is extracted
 */

// ==================== Product Types ====================

export interface POSProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  image: string | null;
}

export interface POSCustomer {
  id: string;
  name: string;
  phone: string | null;
}

// ==================== Cart Types ====================

export interface POSCartItem {
  productId: string;
  product: POSProduct;
  quantity: number;
  salePrice: number;
  subtotal: number;
}

export interface POSCart {
  items: POSCartItem[];
  totalAmount: number;
  totalCost: number;
  profit: number;
  itemCount: number;
}

// ==================== Sale Types ====================

export interface POSCreateSaleInput {
  customerId?: string | null;
  customerName?: string | null;
  paymentMethod: string;
  notes?: string | null;
  items: {
    productId: string;
    quantity: number;
    salePrice: number;
  }[];
}

export interface POSCreateSaleResult {
  success: boolean;
  saleId?: string;
  invoiceNumber?: string;
  error?: string;
}

// ==================== Category Types ====================

export interface POSCategory {
  id: string;
  name: string;
  code: string;
}

// ==================== UI State Types ====================

export type POSPaymentMethod = 'CASH' | 'TRANSFER' | 'CREDIT';

export interface POSState {
  cart: POSCart;
  selectedCategory: string | null;
  searchQuery: string;
  isProcessing: boolean;
}
