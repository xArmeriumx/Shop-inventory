/**
 * purchase-query.service.ts — Read-only operations for Purchases
 */
import { db } from '@/lib/db';
import { Prisma, Permission } from '@prisma/client';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { Security } from '@/services/core/iam/security.service';
import { serializePurchase, serializePurchaseItem } from '@/lib/mappers';
import {
  RequestContext,
  ServiceError,
  GetPurchasesParams,
  GetIncompletePurchasesParams,
} from '@/types/domain';
import { SerializedPurchaseWithItems } from '@/types/serialized';

export const PurchaseQueryService = {
  async getList(params: GetPurchasesParams = {}, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod } = params;

    const searchFilter = buildSearchFilter(search, ['notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where: Prisma.PurchaseWhereInput = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
    };

    const result = await paginatedQuery(db.purchase, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        supplier: { select: { name: true } },
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map(p => ({
        ...serializePurchase(p),
        items: (p as any).items.map((i: any) => serializePurchaseItem(i)),
        supplier: (p as any).supplier
      })),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<SerializedPurchaseWithItems> {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const purchase = await db.purchase.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        supplier: true,
        purchaseTaxLinks: true,
      },
    });

    if (!purchase) {
      throw new ServiceError('ไม่พบข้อมูลการซื้อ');
    }

    const supplierMoq = (purchase as any).supplier?.moq ? Number((purchase as any).supplier.moq) : null;
    const serialized = serializePurchase(purchase) as SerializedPurchaseWithItems & { purchaseTaxLinks: any[] };

    serialized.items = ((purchase as any).items || []).map((i: any) => ({
      ...serializePurchaseItem(i),
      moq: supplierMoq,
    }));

    serialized.supplier = (purchase as any).supplier ? {
      name: (purchase as any).supplier.name,
      phone: (purchase as any).supplier.phone,
      address: (purchase as any).supplier.address,
      taxId: (purchase as any).supplier.taxId,
    } : null;

    serialized.purchaseTaxLinks = (purchase as any).purchaseTaxLinks || [];

    return serialized;
  },

  async getIncompleteRequests(params: GetIncompletePurchasesParams, ctx: RequestContext) {
    Security.requirePermission(ctx, 'PURCHASE_VIEW');
    const where: Prisma.PurchaseWhereInput = { shopId: ctx.shopId, status: 'DRAFT', supplierId: null };
    const count = await db.purchase.count({ where });
    const purchases = await db.purchase.findMany({
      where,
      include: { items: { include: { product: { select: { name: true, sku: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip: ((params.page || 1) - 1) * (params.limit || 10),
      take: params.limit || 10,
    });

    return {
      items: purchases.map(p => ({
        ...serializePurchase(p),
        items: (p as any).items.map((item: any) => serializePurchaseItem(item)),
      })),
      total: count,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: Math.ceil(count / (params.limit || 10)),
    };
  },

  async getSupplierPurchaseInfo(supplierId: string, ctx: RequestContext) {
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, shopId: ctx.shopId },
      select: { purchaseNote: true, moq: true },
    });
    if (!supplier) throw new ServiceError('ไม่พบข้อมูลผู้จำหน่าย');
    return {
      purchaseNote: supplier.purchaseNote,
      moq: supplier.moq ? Number(supplier.moq) : null,
    };
  }
};
