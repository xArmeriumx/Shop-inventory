import { db } from '@/lib/db';
import { Prisma, Product } from '@prisma/client';
import { paginatedQuery, buildSearchFilter } from '@/lib/pagination';
import { serializeProduct } from '@/lib/mappers';
import {
  RequestContext,
  ServiceError,
  PaginatedResult,
  GetProductsParams,
  StockAvailability,
  SerializedProduct,
} from '@/types/domain';

export const ProductQuery = {
  async getById(id: string, ctx: RequestContext): Promise<SerializedProduct> {
    const product = await db.product.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      include: {
        warehouseStocks: {
          include: { warehouse: true }
        }
      }
    });
    if (!product) throw new ServiceError('ไม่พบสินค้า');
    return serializeProduct(product);
  },

  async getAvailability(id: string, ctx: RequestContext): Promise<StockAvailability> {
    const product = await db.product.findFirst({
      where: { id, shopId: ctx.shopId, deletedAt: null },
      select: { stock: true, reservedStock: true, minStock: true, isLowStock: true },
    });
    if (!product) throw new ServiceError('ไม่พบสินค้า');
    return {
      onHand: product.stock,
      reserved: product.reservedStock,
      available: product.stock - product.reservedStock,
      isLowStock: product.isLowStock,
      minStock: product.minStock,
    };
  },

  async getList(params: GetProductsParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>> {
    const { page = 1, limit = 20, search, category, sortBy = 'createdAt', sortOrder = 'desc', lowStockOnly = false, warehouseId } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'sku', 'description']);
    const whereClause = {
      shopId: ctx.shopId,
      deletedAt: null,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
      ...(lowStockOnly && { isLowStock: true }),
      ...(warehouseId && {
        warehouseStocks: { some: { warehouseId } }
      }),
    };
    const result = await paginatedQuery<Product>(db.product, {
      where: whereClause,
      page,
      limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        warehouseStocks: {
          include: { warehouse: { select: { name: true, code: true } } }
        }
      }
    });
    return {
      ...result,
      data: result.data.map(product => serializeProduct(product))
    };
  },

  async getForSelect(ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, stock: { gt: 0 } },
      include: { warehouseStocks: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => serializeProduct(p));
  },

  async getForPurchase(ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null },
      include: { warehouseStocks: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => serializeProduct(p));
  },

  async getLowStock(limit: number = 5, ctx: RequestContext): Promise<SerializedProduct[]> {
    const products = await db.product.findMany({
      where: { shopId: ctx.shopId, isActive: true, deletedAt: null, isLowStock: true },
      orderBy: { stock: 'asc' },
      take: limit,
    });
    return products.map(p => serializeProduct(p));
  },

  async getLowStockPaginated(params: GetProductsParams = {}, ctx: RequestContext): Promise<PaginatedResult<SerializedProduct>> {
    const { page = 1, limit = 20, search, category } = params;
    const searchFilter = buildSearchFilter(search, ['name', 'sku']);
    const whereClause = {
      shopId: ctx.shopId,
      isActive: true,
      deletedAt: null,
      isLowStock: true,
      ...(searchFilter && searchFilter),
      ...(category && { category }),
    };
    const result = await paginatedQuery<Product>(db.product, {
      where: whereClause,
      page,
      limit,
      orderBy: { stock: 'asc' },
    });
    return {
      ...result,
      data: result.data.map(p => serializeProduct(p))
    };
  }
};
