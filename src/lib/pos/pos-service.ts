'use server';

/**
 * POS Service Layer - Abstraction over Server Actions
 * 
 * SEPARATION-READY ARCHITECTURE:
 * - UI components only import from this file
 * - To separate POS into its own project, replace these implementations
 *   with fetch() calls to an external API
 * 
 * Example future change:
 *   getProducts: async () => {
 *     const res = await fetch('https://api.myshop.com/pos/products');
 *     return res.json();
 *   }
 */

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { createSale as createSaleAction } from '@/actions/sales';
import type { 
  POSProduct, 
  POSCategory, 
  POSCreateSaleInput, 
  POSCreateSaleResult,
  POSCustomer
} from './types';

// ==================== Customer Operations ====================

/**
 * Get all active customers for POS selection
 * Optimized query: only fetches id, name, phone
 */
export async function getPOSCustomers(): Promise<POSCustomer[]> {
  const ctx = await requirePermission('POS_ACCESS');

  const customers = await db.customer.findMany({
    where: {
      shopId: ctx.shopId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      phone: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return customers.map(c => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }));
}

/**
 * Get all active products for POS display
 * Optimized query: only fetches fields needed for POS
 */
export async function getProductsForPOS(): Promise<POSProduct[]> {
  const ctx = await requirePermission('POS_ACCESS');

  const products = await db.product.findMany({
    where: {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      salePrice: true,
      costPrice: true,
      stock: true,
      images: true,
    },
    orderBy: [
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    salePrice: Number(p.salePrice),
    costPrice: Number(p.costPrice),
    stock: p.stock,
    image: p.images[0] || null,
  }));
}

/**
 * Search product by SKU (for barcode scanning)
 */
export async function getProductBySKU(sku: string): Promise<POSProduct | null> {
  const ctx = await requirePermission('POS_ACCESS');

  const product = await db.product.findFirst({
    where: {
      shopId: ctx.shopId,
      sku,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      salePrice: true,
      costPrice: true,
      stock: true,
      images: true,
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    salePrice: Number(product.salePrice),
    costPrice: Number(product.costPrice),
    stock: product.stock,
    image: product.images[0] || null,
  };
}

// ==================== Category Operations ====================

/**
 * Get unique product categories for filter tabs
 */
export async function getCategories(): Promise<POSCategory[]> {
  const ctx = await requirePermission('POS_ACCESS');

  const categories = await db.product.groupBy({
    by: ['category'],
    where: {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: {
      category: 'asc',
    },
  });

  return categories.map((c, index) => ({
    id: `cat-${index}`,
    name: c.category,
    code: c.category,
  }));
}

// ==================== Sale Operations ====================

/**
 * Create a new sale from POS
 * Wraps the existing createSale action
 */
// ... imports

// Update existing createPOSSale to handle new ActionResponse structure
export async function createPOSSale(input: POSCreateSaleInput): Promise<POSCreateSaleResult> {
  try {
    const result = await createSaleAction({
      customerId: input.customerId || null,
      customerName: input.customerName || null,
      paymentMethod: input.paymentMethod as 'CASH' | 'TRANSFER' | 'CREDIT',
      notes: input.notes || null,
      receiptUrl: input.receiptUrl || null,
      items: input.items.map(item => ({ ...item, discountAmount: 0 })),
    });

    // Cast response to expected type to satisfy TS
    const actionResult = result as unknown as { success: boolean, message?: string, errors?: any, data?: any };

    if (!actionResult.success) {
      let errorMessage = actionResult.message || 'เกิดข้อผิดพลาดในการบันทึกการขาย';
      
      // Type guard for errors object
      if (actionResult.errors && typeof actionResult.errors === 'object') {
        const fieldErrors = actionResult.errors as Record<string, string[]>;
        const firstErrorKey = Object.keys(fieldErrors)[0];
        if (firstErrorKey && fieldErrors[firstErrorKey]) {
           errorMessage = fieldErrors[firstErrorKey][0];
        }
      } else if (typeof actionResult.errors === 'string') {
        errorMessage = actionResult.errors;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Success case
    if (actionResult.data) {
      return {
        success: true,
        saleId: actionResult.data.id,
        invoiceNumber: actionResult.data.invoiceNumber,
      };
    }

    return {
      success: false,
      error: 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
    };
  } catch (error) {
    console.error('POS Sale Error:', error);
    return {
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
    };
  }
}
