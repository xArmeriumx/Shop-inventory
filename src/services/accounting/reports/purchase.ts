/**
 * purchase-report.query.ts — Procurement analysis queries
 * Responsibilities: purchase cost report (currency conversion), procurement aging/lead time
 */
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { calculateCtn } from '@/lib/erp-utils';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * UC 14 & 16: Purchase report with currency conversion (CNY→USD) and freight allocation
 */
export async function getPurchaseReport(
  purchaseId: string,
  exchangeRate: number,
  ctx: RequestContext
) {
  const purchase = await db.purchase.findFirst({
    where: { id: purchaseId, shopId: ctx.shopId },
    include: { items: { include: { product: true } }, supplier: true },
  });

  if (!purchase) throw new Error('ไม่พบข้อมูลการซื้อ');

  const items = purchase.items.map((item) => {
    const costCNY = toNumber(item.costPrice);
    const costUSD = costCNY / exchangeRate;
    return {
      ...item,
      packagingQty: item.packagingQty || 1,
      ctn: calculateCtn(item.quantity, item.packagingQty || 1),
      costCNY,
      costUSD: Number(costUSD.toFixed(4)),
      subtotalCNY: toNumber(item.subtotal),
      subtotalUSD: Number((toNumber(item.subtotal) / exchangeRate).toFixed(2)),
    };
  });

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    items,
    exchangeRate,
    summary: {
      totalCNY: items.reduce((sum, i) => sum + i.subtotalCNY, 0),
      totalUSD: items.reduce((sum, i) => sum + i.subtotalUSD, 0),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * UC 20: Procurement Aging — PR→PO→Receive lead time analysis per supplier
 */
export async function getProcurementAging(limit = 20, ctx: RequestContext) {
  const purchases = await db.purchase.findMany({
    where: {
      shopId: ctx.shopId,
      docType: 'ORDER',
      status: 'RECEIVED',
      receivedAt: { not: null },
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  const items = await Promise.all(
    purchases.map(async (po) => {
      let prDate = po.createdAt;

      if (po.linkedPRId) {
        const pr = await db.purchase.findUnique({
          where: { id: po.linkedPRId, shopId: ctx.shopId },
          select: { createdAt: true },
        });
        if (pr) prDate = pr.createdAt;
      }

      const leadTimeDays = Math.ceil(
        (po.receivedAt!.getTime() - prDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: po.id,
        purchaseNumber: po.purchaseNumber,
        supplierName: po.supplier?.name || 'Unknown',
        requestDate: prDate,
        orderDate: po.createdAt,
        receivedDate: po.receivedAt!,
        leadTimeDays,
        totalCost: toNumber(po.totalCost),
      };
    })
  );

  // Aggregate avg lead time per supplier
  const supplierAgg = new Map<string, { totalDays: number; count: number }>();
  items.forEach((item) => {
    const current = supplierAgg.get(item.supplierName) || { totalDays: 0, count: 0 };
    current.totalDays += item.leadTimeDays;
    current.count++;
    supplierAgg.set(item.supplierName, current);
  });

  const supplierPerformance = Array.from(supplierAgg.entries())
    .map(([name, stats]) => ({
      supplierName: name,
      avgLeadTime: Math.round(stats.totalDays / stats.count),
      orderCount: stats.count,
    }))
    .sort((a, b) => a.avgLeadTime - b.avgLeadTime);

  return { items, supplierPerformance };
}
