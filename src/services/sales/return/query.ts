import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  RequestContext,
  PaginatedResult,
} from '@/types/domain';
import { paginatedQuery } from '@/lib/pagination';
import {
  serializeReturn,
  serializeReturnItem
} from '@/lib/mappers';
import { money, toNumber } from '@/lib/money';

export const ReturnQuery = {
  async getReturnableSaleItems(saleId: string, ctx: RequestContext) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, shopId: ctx.shopId, status: { not: 'CANCELLED' } },
      select: {
        totalAmount: true,
        discountAmount: true,
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            returnItems: { select: { quantity: true } },
          },
        },
      },
    });

    if (!sale) return null;

    const saleTotal = toNumber(sale.totalAmount);
    const saleDiscount = toNumber(sale.discountAmount);
    const billDiscountRatio = saleTotal > 0
      ? money.divide(money.subtract(saleTotal, saleDiscount), saleTotal)
      : 1;

    return (sale.items as any[]).map((item: any) => {
      const alreadyReturned = (item.returnItems as any[]).reduce((sum: number, ri: any) => sum + ri.quantity, 0);
      const maxReturnable = item.quantity - alreadyReturned;

      const subtotal = toNumber(item.subtotal);
      const discount = toNumber(item.discountAmount);
      const itemNetPerUnit = item.quantity > 0
        ? money.round(money.divide(money.subtract(subtotal, discount), item.quantity))
        : 0;

      const netPerUnit = money.round(money.multiply(itemNetPerUnit, billDiscountRatio));

      return {
        saleItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        originalQuantity: item.quantity,
        alreadyReturned,
        maxReturnable,
        salePrice: toNumber(item.salePrice),
        netPerUnit,
      };
    }).filter(item => item.maxReturnable > 0);
  },

  async getList(options: { page?: number; limit?: number; search?: string; }, ctx: RequestContext): Promise<PaginatedResult<any>> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const where: Prisma.ReturnWhereInput = { shopId: ctx.shopId };

    if (options?.search) {
      where.OR = [
        { returnNumber: { contains: options.search, mode: 'insensitive' } },
        { reason: { contains: options.search, mode: 'insensitive' } },
        { sale: { invoiceNumber: { contains: options.search, mode: 'insensitive' } } },
      ];
    }

    const result = await paginatedQuery(db.return as any, {
      where,
      include: {
        sale: { select: { invoiceNumber: true } },
        user: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      page,
      limit,
    });

    return {
      ...result,
      data: result.data.map((r: any) => ({
        ...serializeReturn(r),
        items: ((r as any).items || []).map((ri: any) => serializeReturnItem(ri)),
        sale: (r as any).sale || null,
        user: (r as any).user || null
      })),
    };
  },

  async getById(returnId: string, ctx: RequestContext) {
    const returnRecord = await db.return.findFirst({
      where: { id: returnId, shopId: ctx.shopId },
      include: {
        sale: {
          select: {
            invoiceNumber: true,
            date: true,
            customerName: true,
            customer: { select: { name: true, phone: true } },
          },
        },
        user: { select: { name: true } },
        items: {
          include: {
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });

    if (!returnRecord) return null;

    return {
      ...serializeReturn(returnRecord),
      items: ((returnRecord as any).items || []).map((ri: any) => serializeReturnItem(ri)),
      sale: (returnRecord as any).sale || null,
      user: (returnRecord as any).user || null
    };
  }
};
