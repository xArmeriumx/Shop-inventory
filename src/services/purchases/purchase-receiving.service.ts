import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';

export async function getPurchaseOrderItemsForReceiving(ctx: RequestContext, purchaseId: string) {
  const purchase = await db.purchase.findUnique({
    where: {
      id: purchaseId,
      shopId: ctx.shopId
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true
        }
      }
    }
  });

  if (!purchase) {
    throw new ServiceError('ไม่พบใบสั่งซื้อ');
  }

  if (purchase.status === 'CANCELLED') {
    throw new ServiceError('ไม่สามารถรับสินค้าจากใบสั่งซื้อที่ยกเลิกแล้ว');
  }

  return purchase;
}

export async function getPendingPurchaseOrders(ctx: RequestContext, params: { page?: number; limit?: number }) {
  const { page = 1, limit = 10 } = params;
  const skip = (page - 1) * limit;

  const where = {
    shopId: ctx.shopId,
    status: {
      in: ['ORDERED', 'PARTIALLY_RECEIVED']
    },
    docType: 'ORDER'
  };

  const [data, total] = await Promise.all([
    db.purchase.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: { name: true, sku: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit
    }),
    db.purchase.count({ where })
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}
