import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';
import { SupplierInput } from '@/schemas/supplier';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import type { Supplier } from '@prisma/client';
import { toNumber } from '@/lib/money';

export interface GetSuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const SupplierService = {
  async getForSelect(ctx: RequestContext) {
    return db.supplier.findMany({
      where: {
        shopId: ctx.shopId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        phone: true,
      },
      orderBy: { name: 'asc' },
    });
  },

  async getList(params: GetSuppliersParams = {}, ctx: RequestContext) {
    const { page = 1, limit = 20, search } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'code', 'phone', 'email', 'contactName']);
    
    return paginatedQuery(db.supplier, {
      where: {
        shopId: ctx.shopId,
        deletedAt: null,
        ...searchFilter,
      },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
      page,
      limit,
      orderBy: { name: 'asc' },
    });
  },

  async getById(id: string, ctx: RequestContext) {
    const supplier = await db.supplier.findFirst({
      where: {
        id,
        shopId: ctx.shopId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
    
    if (!supplier) {
      throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    }
    
    return supplier;
  },

  async create(data: SupplierInput, ctx: RequestContext) {
    return db.supplier.create({
      data: {
        ...data,
        userId: ctx.userId,
        shopId: ctx.shopId,
      },
    });
  },

  async update(id: string, data: SupplierInput, ctx: RequestContext) {
    const existing = await db.supplier.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    }

    return db.supplier.update({
      where: { id },
      data,
    });
  },

  async delete(id: string, ctx: RequestContext) {
    const existing = await db.supplier.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
    });

    if (!existing) {
      throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    }

    const purchaseCount = await db.purchase.count({
      where: { supplierId: id },
    });
    
    if (purchaseCount > 0) {
      throw new ServiceError(`ไม่สามารถลบผู้จำหน่ายที่มีประวัติการซื้อ ${purchaseCount} รายการ`);
    }
    
    return db.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async getProfile(id: string, ctx: RequestContext) {
    const [supplier, purchases, stats, topProducts] = await Promise.all([
      db.supplier.findFirst({
        where: { id, shopId: ctx.shopId, deletedAt: null },
      }),
      db.purchase.findMany({
        where: { supplierId: id, shopId: ctx.shopId },
        select: {
          id: true,
          date: true,
          totalCost: true,
          status: true,
          items: {
            select: {
              quantity: true,
              product: { select: { name: true } },
            },
            take: 3,
          },
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
      db.purchase.aggregate({
        where: {
          supplierId: id,
          shopId: ctx.shopId,
          status: { not: 'CANCELLED' },
        },
        _sum: { totalCost: true },
        _count: true,
        _avg: { totalCost: true },
      }),
      db.purchaseItem.groupBy({
        by: ['productId'],
        where: {
          purchase: {
            supplierId: id,
            shopId: ctx.shopId,
            status: { not: 'CANCELLED' },
          },
        },
        _sum: { quantity: true, subtotal: true },
        _count: true,
        orderBy: { _sum: { subtotal: 'desc' } },
        take: 10,
      }),
    ]);

    if (!supplier) {
      throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    }

    let topProductsWithNames: any[] = [];
    if (topProducts.length > 0) {
      const productIds = topProducts.map((tp: any) => tp.productId);
      const products = await db.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, sku: true },
      });
      const productMap = new Map(products.map(p => [p.id, p]));

      topProductsWithNames = topProducts.map((tp: any) => {
        const product = productMap.get(tp.productId);
        return {
          productId: tp.productId,
          name: product?.name || 'สินค้าที่ลบแล้ว',
          sku: product?.sku || null,
          totalQuantity: tp._sum.quantity || 0,
          totalCost: toNumber(tp._sum.subtotal),
          orderCount: tp._count,
        };
      });
    }

    const lastPurchase = purchases.length > 0 ? purchases[0] : null;

    let avgDaysBetweenOrders = 0;
    if (purchases.length >= 2) {
      const activePurchases = purchases.filter(p => p.status !== 'CANCELLED');
      if (activePurchases.length >= 2) {
        const first = activePurchases[activePurchases.length - 1].date;
        const last = activePurchases[0].date;
        const daysDiff = Math.max(1, Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
        avgDaysBetweenOrders = Math.round(daysDiff / (activePurchases.length - 1));
      }
    }

    return {
      supplier,
      purchases: purchases.map(p => ({
        ...p,
        totalCost: toNumber(p.totalCost),
      })),
      stats: {
        totalSpend: toNumber(stats._sum?.totalCost),
        orderCount: stats._count,
        avgOrderValue: toNumber(stats._avg?.totalCost),
        lastPurchaseDate: lastPurchase?.date || null,
        avgDaysBetweenOrders,
      },
      topProducts: topProductsWithNames,
    };
  }
};
