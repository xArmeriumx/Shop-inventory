import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';

export const StockQuery = {
  async getProductHistory(ctx: RequestContext, productId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      (db as any).stockLog.findMany({
        where: { productId, shopId: ctx.shopId },
        include: {
          warehouse: { select: { name: true } },
          user: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (db as any).stockLog.count({ where: { productId, shopId: ctx.shopId } }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
};
