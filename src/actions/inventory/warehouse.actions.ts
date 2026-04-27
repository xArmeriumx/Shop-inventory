'use server';

import { db } from '@/lib/db';
import { revalidatePath, revalidateTag } from 'next/cache';
import { WarehouseService } from '@/services/inventory/warehouse.service';
import { warehouseSchema } from '@/schemas/inventory/warehouse-form.schema';
import { requireShop, requirePermission } from '@/lib/auth-guard';
import { ActionResponse } from '@/types/common';
import { PerformanceCollector } from '@/lib/debug/measurement';
import { handleAction } from '@/lib/action-handler';

export async function createWarehouseAction(data: any): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const context = await requireShop();
      await requirePermission('PRODUCT_UPDATE');

      const validatedData = warehouseSchema.parse(data);
      const result = await WarehouseService.createWarehouse(context as any, validatedData);

      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return result.data;
    });
  }, { context: { action: 'createWarehouse' } });
}

export async function getWarehousesAction(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const context = await requireShop();
      const warehouses = await WarehouseService.getWarehouses(context as any);
      return warehouses;
    });
  }, { context: { action: 'getWarehouses' } });
}

/**
 * Product Detail: Warehouse Breakdown Tab
 * Returns WarehouseStock rows for a product — per warehouse with updatedAt
 */
export async function getProductStockBreakdownAction(productId: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requirePermission('PRODUCT_VIEW');
      return WarehouseService.getProductStockBreakdown(ctx as any, productId);
    }, 'inventory:getProductStockBreakdown');
  }, { context: { action: 'getProductStockBreakdown', productId } });
}

/**
 * Mobile Lookup: Search product by SKU or Name
 */
export async function quickSearchProduct(query: string): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();

      const product = await db.product.findFirst({
        where: {
          shopId: ctx.shopId,
          deletedAt: null,
          OR: [
            { sku: { equals: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ]
        },
        include: {
          categoryRef: true,
          warehouseStocks: { include: { warehouse: true } }
        }
      });

      if (!product) return null;

      // Calculate reserved stock from Sales that are CONFIRMED but not shipped
      const reserved = await db.saleItem.aggregate({
        where: {
          productId: product.id,
          sale: { status: 'CONFIRMED', shopId: ctx.shopId }
        },
        _sum: { quantity: true }
      });

      return {
        ...product,
        category: (product as any).categoryRef?.name || product.category,
        reservedStock: reserved._sum.quantity || 0,
        isLowStock: product.stock <= (product.minStock || 0)
      };
    }, 'inventory:quickSearchProduct');
  }, { context: { action: 'quickSearchProduct', query } });
}

/**
 * Mobile Adjust: Quick stock adjustment
 */
export async function quickAdjustStock(
  productId: string,
  type: 'ADD' | 'REMOVE' | 'SET',
  quantity: number,
  note: string
): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      await requirePermission('PRODUCT_UPDATE');

      const defaultWh = await WarehouseService.getDefaultWarehouse(ctx as any);
      if (!defaultWh) throw new Error('ไม่พบคลังสินค้าหลัก');

      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('ไม่พบสินค้า');

      let delta = quantity;
      if (type === 'REMOVE') delta = -quantity;
      if (type === 'SET') delta = quantity - product.stock;

      const result = await WarehouseService.adjustWarehouseStock(ctx as any, {
        warehouseId: defaultWh.id,
        productId,
        delta
      });

      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return null;
    });
  }, { context: { action: 'quickAdjustStock' } });
}

/**
 * Mobile Receive: List pending Purchase Orders
 */
export async function getPendingDeliveries(): Promise<ActionResponse<any>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      return await db.purchase.findMany({
        where: {
          shopId: ctx.shopId,
          status: 'ORDERED'
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        },
        orderBy: { date: 'desc' }
      });
    });
  }, { context: { action: 'getPendingDeliveries' } });
}

/**
 * Mobile Receive: Confirm PO Receipt
 */
export async function confirmReceipt(purchaseId: string): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      await requirePermission('PRODUCT_UPDATE');

      const po = await db.purchase.findUnique({
        where: { id: purchaseId, shopId: ctx.shopId },
        include: { items: true }
      });

      if (!po) throw new Error('ไม่พบใบสั่งซื้อ');
      if (po.status !== 'ORDERED') throw new Error('ใบสั่งซื้อไม่ได้อยู่ในสถานะรอรับของ');

      const defaultWh = await WarehouseService.getDefaultWarehouse(ctx as any);
      if (!defaultWh) throw new Error('ไม่พบคลังสินค้าหลัก');

      await db.$transaction(async (tx) => {
        await tx.purchase.update({
          where: { id: purchaseId },
          data: { status: 'RECEIVED' }
        });

        for (const item of po.items) {
          const result = await WarehouseService.adjustWarehouseStock(ctx as any, {
            warehouseId: defaultWh.id,
            productId: item.productId,
            delta: item.quantity
          }, tx);

          if (result.affectedTags) {
            result.affectedTags.forEach(tag => revalidateTag(tag));
          }
        }
      });

      const { PURCHASE_TAGS } = await import('@/config/cache-tags');
      revalidateTag(PURCHASE_TAGS.LIST);
      return null;
    });
  }, { context: { action: 'confirmReceipt' } });
}
export async function transferStockAction(input: {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}): Promise<ActionResponse<null>> {
  return handleAction(async () => {
    return PerformanceCollector.run(async () => {
      const ctx = await requireShop();
      await requirePermission('STOCK_ADJUST');

      const result = await WarehouseService.transferStock(ctx as any, input);

      if (result.affectedTags) {
        result.affectedTags.forEach(tag => revalidateTag(tag));
      }

      return null;
    }, 'inventory:transferStock');
  }, { context: { action: 'transferStock', ...input } });
}
