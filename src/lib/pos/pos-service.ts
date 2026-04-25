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
import { posCheckout } from '@/actions/sales/pos.actions';
import type {
  POSProduct,
  POSCategory,
  POSCreateSaleInput,
  POSCustomer
} from './types';
import { handleAction, type ActionResponse } from '@/lib/action-handler';

// ==================== Customer Operations ====================

/**
 * Get all active customers for POS selection
 * Optimized query: only fetches id, name, phone
 */
export async function getPOSCustomers(): Promise<ActionResponse<POSCustomer[]>> {
  return handleAction(async () => {
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
  });
}

/**
 * Get all active products for POS display
 * Optimized query: only fetches fields needed for POS
 */
export async function getProductsForPOS(): Promise<ActionResponse<POSProduct[]>> {
  return handleAction(async () => {
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
        reservedStock: true,
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
      reservedStock: p.reservedStock,
      image: p.images[0] || null,
    }));
  });
}

/**
 * Search product by SKU (for barcode scanning)
 */
export async function getProductBySKU(sku: string): Promise<ActionResponse<POSProduct | null>> {
  return handleAction(async () => {
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
        reservedStock: true,
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
      reservedStock: product.reservedStock,
      image: product.images[0] || null,
    };
  });
}

// ==================== Category Operations ====================

/**
 * Get unique product categories for filter tabs
 */
export async function getCategories(): Promise<ActionResponse<POSCategory[]>> {
  return handleAction(async () => {
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
  });
}

// ==================== Sale Operations ====================

/**
 * Create a new sale from POS
 * Now uses the optimized POS atomic service flow
 */
export async function createPOSSale(input: POSCreateSaleInput): Promise<ActionResponse<any>> {
  return posCheckout({
    customerId: input.customerId ?? undefined,
    customerName: input.customerName ?? undefined,
    paymentMethod: input.paymentMethod as any,
    notes: input.notes ?? undefined,
    items: input.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      salePrice: item.salePrice,
    })),
  });
}
