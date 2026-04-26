'use server';

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

/**
 * ⚡ POS SEPARATION-READY SERVICES (Hardened)
 * 
 * ทุกฟังก์ชันถูกหุ้มด้วย handleAction เพื่อความเสถียรสูงสุด
 */

// ==================== Customer Operations ====================

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
  }, { context: { service: 'getPOSCustomers' } });
}

// ==================== Product Operations ====================

export async function getProductsForPOS(): Promise<ActionResponse<POSProduct[]>> {
  return handleAction(async () => {
    const ctx = await requirePermission('POS_ACCESS');

    // ตรวจสอบว่า shopId มีอยู่จริงเพื่อความปลอดภัย (Defensive Coding)
    if (!ctx.shopId) {
        throw new Error('SHOP_ID_NOT_FOUND: กรุณาตั้งค่าร้านค้าก่อนใช้งาน POS');
    }

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

    // 🛡️ Safe Transform: ป้องกันปัญหา BigInt หรือ Decimal ที่ Client อ่านไม่ได้
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: p.category || 'Uncategorized',
      salePrice: Number(p.salePrice || 0),
      costPrice: Number(p.costPrice || 0),
      stock: p.stock ?? 0,
      reservedStock: p.reservedStock ?? 0,
      image: (p.images && p.images.length > 0) ? p.images[0] : null,
    }));
  }, { context: { service: 'getProductsForPOS' } });
}

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
      sku: product.sku || '',
      category: product.category || 'Uncategorized',
      salePrice: Number(product.salePrice || 0),
      costPrice: Number(product.costPrice || 0),
      stock: product.stock ?? 0,
      reservedStock: product.reservedStock ?? 0,
      image: (product.images && product.images.length > 0) ? product.images[0] : null,
    };
  }, { context: { service: 'getProductBySKU', sku } });
}

// ==================== Category Operations ====================

export async function getCategories(): Promise<ActionResponse<POSCategory[]>> {
  return handleAction(async () => {
    const ctx = await requirePermission('POS_ACCESS');

    // 🚀 Performance Optimization: ใช้ groupBy เพื่อดึงหมวดหมู่ที่ใช้จริงเท่านั้น
    const categoriesGroups = await db.product.groupBy({
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

    return categoriesGroups.map((c, index) => ({
      id: `cat-${index}-${c.category}`,
      name: c.category || 'General',
      code: c.category || 'general',
    }));
  }, { context: { service: 'getCategories' } });
}

// ==================== Sale Operations ====================

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
