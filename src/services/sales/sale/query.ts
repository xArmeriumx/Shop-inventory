/**
 * sale-query.service.ts — Read-only operations for Sales
 */
import { db } from '@/lib/db';
import { Permission } from '@prisma/client';
import { paginatedQuery, buildSearchFilter, buildDateRangeFilter } from '@/lib/pagination';
import { Security } from '@/services/core/iam/security.service';
import { SaleMapper } from '@/lib/mappers/sales.mapper';
import { resolveLocked } from '@/lib/lock-helpers';
import {
  RequestContext,
  ServiceError,
  GetSalesParams,
  PaginatedResult,
  SaleListDTO,
  SaleDetailDTO,
  SerializedSale,
  SaleStatus,
} from '@/types/domain';

export const SaleQueryService = {
  async getList(params: GetSalesParams = {}, ctx: RequestContext): Promise<PaginatedResult<SaleListDTO>> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { page = 1, limit = 20, search, startDate, endDate, paymentMethod, channel, status } = params;

    const searchFilter = buildSearchFilter(search, ['invoiceNumber', 'customerName', 'notes']);
    const dateFilter = buildDateRangeFilter(startDate, endDate);

    const where = {
      shopId: ctx.shopId,
      ...(searchFilter && searchFilter),
      ...(dateFilter && { date: dateFilter }),
      ...(paymentMethod && { paymentMethod }),
      ...(channel && { channel }),
      ...(status && { status }),
      ...(params.salesFlowMode && {
        channel: params.salesFlowMode === 'RETAIL' ? 'POS' : 'ERP',
      }),
    };

    const result = await paginatedQuery(db.sale, {
      where,
      include: {
        items: { include: { product: { select: { name: true } } } },
        customer: true,
        statusDetail: true,
        taxSummary: true,
        paymentDetail: true,
      },
      page,
      limit,
      orderBy: { date: 'desc' },
    });

    return {
      ...result,
      data: result.data.map((sale: any) => SaleMapper.toListDTO(sale)),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<SaleDetailDTO> {
    Security.require(ctx, Permission.SALE_VIEW);

    const sale = await db.sale.findFirst({
      where: { id, shopId: ctx.shopId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true, stock: true, reservedStock: true, packagingQty: true } } } },
        customer: true,
        statusDetail: true,
        taxSummary: true,
        paymentDetail: true,
        shipments: {
          select: {
            id: true, shipmentNumber: true, status: true, trackingNumber: true, shippingProvider: true, shippingCost: true,
          },
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!sale) throw new ServiceError('ไม่พบข้อมูลการขาย');

    return SaleMapper.toDetailDTO(sale, ctx);
  },

  async getTodayAggregate(ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<{ totalSales: number; saleCount: number; profit?: number }> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, profit: true },
      _count: true,
    });

    return {
      totalSales: Number(result._sum.netAmount) || 0,
      profit: canViewProfit ? (Number(result._sum.profit) || 0) : undefined,
      saleCount: result._count,
    };
  },

  async getRecentList(limit: number, ctx: RequestContext, options: { canViewProfit?: boolean } = {}): Promise<SerializedSale[]> {
    Security.require(ctx, Permission.SALE_VIEW);
    const { canViewProfit = false } = options;
    if (canViewProfit) Security.require(ctx, Permission.SALE_VIEW_PROFIT);

    const sales = await db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        status: { not: 'CANCELLED' },
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales.map(sale => SaleMapper.toListDTO(sale)) as any;
  },

  async getLockedFields(saleId: string, ctx: RequestContext): Promise<string[]> {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId },
      select: { status: true, editLockStatus: true },
    });

    if (!sale) return [];

    const locked = [];
    if (resolveLocked(sale as any) || sale.status === SaleStatus.INVOICED || sale.status === SaleStatus.COMPLETED) {
      locked.push('items', 'customerId', 'discountType', 'discountValue');
    }
    if (sale.status === SaleStatus.COMPLETED) {
      locked.push('paymentMethod', 'notes');
    }

    return locked;
  }
};
