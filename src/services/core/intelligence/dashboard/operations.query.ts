import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';

export const DashboardOperationsQuery = {
  async getOperationalMetrics(ctx: RequestContext, warehouseId?: string) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 3);

    const whShipmentFilter = warehouseId ? { warehouseId } : {};
    const whSaleFilter = warehouseId
      ? { items: { some: { warehouseId } } } as any
      : {};

    const [
      pendingSalesCount,
      pendingProcurementCount,
      pendingShipmentsCount,
      recentStockMoves,
      prToOrderCount,
      incompleteShipmentsCount,
      stuckSalesCount,
      stuckPurchasesCount,
      governanceIncidentsToday
    ] = await Promise.all([
      db.sale.count({
        where: { shopId: ctx.shopId, status: { in: ['DRAFT', 'CONFIRMED'] }, ...whSaleFilter }
      }),
      db.purchase.count({
        where: { shopId: ctx.shopId, status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] } }
      }),
      db.shipment.count({
        where: { shopId: ctx.shopId, status: { in: ['PENDING', 'PROCESSING'] }, ...whShipmentFilter }
      }),
      db.auditLog.findMany({
        where: { shopId: ctx.shopId, action: 'STOCK_MOVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, actorName: true, note: true, targetId: true }
      }),
      db.purchase.count({
        where: { shopId: ctx.shopId, docType: 'REQUEST', status: 'APPROVED' }
      }),
      db.shipment.count({
        where: {
          shopId: ctx.shopId,
          status: { notIn: ['CANCELLED', 'DELIVERED'] },
          ...whShipmentFilter,
          OR: [{ latitude: null }, { longitude: null }]
        }
      }),
      db.sale.count({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
          createdAt: { lt: limitDate },
          ...whSaleFilter
        }
      }),
      db.purchase.count({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] },
          createdAt: { lt: limitDate }
        }
      }),
      db.auditLog.count({
        where: {
          shopId: ctx.shopId,
          status: 'DENIED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
    ]);

    return {
      sme: {
        pendingSales: pendingSalesCount,
        pendingProcurement: pendingProcurementCount,
        pendingShipments: pendingShipmentsCount,
        recentStockMoves: recentStockMoves.map(log => ({
          id: log.id,
          date: log.createdAt,
          actor: log.actorName || 'ระบบ',
          note: log.note || 'ปรับปรุงสต็อก',
          productId: log.targetId
        })),
      },
      advanced: {
        prToOrder: prToOrderCount,
        incompleteShipments: incompleteShipmentsCount,
        stuckDocs: stuckSalesCount + stuckPurchasesCount,
        governanceIncidents: governanceIncidentsToday,
      }
    };
  }
};
