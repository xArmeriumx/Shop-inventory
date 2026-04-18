'use server';

import { db } from '@/lib/db';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { ProductService } from '@/services/product.service';
import { PurchaseService } from '@/services/purchase.service';
import { revalidatePath } from 'next/cache';
import { ServiceError } from '@/types/domain';

/**
 * ค้นหาสินค้าดีแบบด่วน (เน้น SKU/Barcode) สำหรับมือถือ
 */
export async function quickSearchProduct(query: string) {
  const ctx = await requireShop();

  // ค้นหาแบบเป๊ะๆ ด้วย SKU ก่อน (โหมดเครื่องยิง Barcode)
  const exactMatch = await db.product.findFirst({
    where: {
      shopId: ctx.shopId,
      sku: query,
      isActive: true,
      deletedAt: null
    },
    include: { categoryRef: true }
  });

  if (exactMatch) {
    return {
      ...exactMatch,
      costPrice: Number(exactMatch.costPrice),
      salePrice: Number(exactMatch.salePrice),
    };
  }

  // ถ้าไม่เจอ ให้ค้นหาด้วยชื่อ (เปรียบเทียบคำ)
  const results = await ProductService.getList({ search: query, limit: 5 }, ctx);
  return results.data[0] || null; // คืนค่าตัวแรกที่ใกล้เคียงที่สุด
}

/**
 * ปรับปรุงสต็อกแบบด่วนจากมือถือ
 */
export async function quickAdjustStock(productId: string, type: 'ADD' | 'REMOVE' | 'SET', quantity: number, note: string) {
  const ctx = await requirePermission('STOCK_ADJUST');
  const result = await ProductService.adjustStockManual(productId, { type, quantity, description: note }, ctx);
  revalidatePath('/warehouse');
  revalidatePath('/dashboard');
  return result;
}

/**
 * ดึงรายการสั่งซื้อที่รอรับของ (ORDERED)
 */
export async function getPendingDeliveries() {
  const ctx = await requireShop();
  const purchases = await db.purchase.findMany({
    where: {
      shopId: ctx.shopId,
      status: 'ORDERED',
      docType: 'ORDER'
    },
    include: {
      supplier: { select: { name: true } },
      items: {
        include: { product: { select: { name: true, sku: true } } }
      }
    },
    orderBy: { date: 'desc' }
  });

  return purchases.map(p => ({
    ...p,
    totalCost: Number(p.totalCost),
    items: p.items.map(item => ({
      ...item,
      costPrice: Number(item.costPrice),
      subtotal: Number(item.subtotal),
    }))
  }));
}

/**
 * ยืนยันการรับสินค้าเข้าคลัง
 */
export async function confirmReceipt(purchaseId: string) {
  const ctx = await requirePermission('PURCHASE_APPROVE');
  const result = await PurchaseService.receivePurchase(purchaseId, ctx);
  revalidatePath('/warehouse');
  revalidatePath('/purchases');
  revalidatePath('/dashboard');
  return result;
}
