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
import { getCurrentUserId } from '@/lib/auth-guard';
import { createSale as createSaleAction } from '@/actions/sales';
import type { 
  POSProduct, 
  POSCategory, 
  POSCreateSaleInput, 
  POSCreateSaleResult 
} from './types';

// ==================== Product Operations ====================

/**
 * Get all active products for POS display
 * Optimized query: only fetches fields needed for POS
 */
export async function getProductsForPOS(): Promise<POSProduct[]> {
  const userId = await getCurrentUserId();

  const products = await db.product.findMany({
    where: {
      userId,
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
  const userId = await getCurrentUserId();

  const product = await db.product.findFirst({
    where: {
      userId,
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
  const userId = await getCurrentUserId();

  const categories = await db.product.groupBy({
    by: ['category'],
    where: {
      userId,
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
export async function createPOSSale(input: POSCreateSaleInput): Promise<POSCreateSaleResult> {
  try {
    const result = await createSaleAction({
      customerId: input.customerId || null,
      customerName: input.customerName || null,
      paymentMethod: input.paymentMethod as 'CASH' | 'TRANSFER' | 'CREDIT',
      notes: input.notes || null,
      items: input.items,
    });

    // Check for error (result.error exists when validation fails or transaction fails)
    if ('error' in result && result.error) {
      // Handle field errors object or string
      let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกการขาย';
      
      if (typeof result.error === 'object') {
        // Field errors from Zod validation
        const fieldErrors = result.error as Record<string, string[]>;
        const firstError = Object.values(fieldErrors).flat()[0];
        if (firstError) {
          errorMessage = firstError;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    // Success case
    if ('data' in result && result.data) {
      return {
        success: true,
        saleId: result.data.id,
        invoiceNumber: result.data.invoiceNumber,
      };
    }

    // Fallback error
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
