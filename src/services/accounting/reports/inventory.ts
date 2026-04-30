/**
 * inventory-report.query.ts — Inventory KPI & intelligence queries
 */
import { db } from '@/lib/db';
import { money, toNumber } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { resolveDateRange, ANALYTICS_THRESHOLDS, InventoryIntelligence } from './helpers';
import { getProcurementAging } from './purchase';

export async function getStockValueReport(ctx: RequestContext, warehouseId?: string) {
  const [products, lastSaleByProduct] = await Promise.all([
    db.product.findMany({
      where: {
        shopId: ctx.shopId, isActive: true, deletedAt: null,
        ...(warehouseId && { warehouseStocks: { some: { warehouseId } } }),
      },
      select: {
        id: true, name: true, sku: true, category: true,
        costPrice: true, salePrice: true, stock: true, minStock: true, isLowStock: true,
        ...(warehouseId && {
          warehouseStocks: { where: { warehouseId }, select: { quantity: true } },
        }),
      },
      orderBy: { name: 'asc' },
    }),
    db.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { shopId: ctx.shopId, status: { not: 'CANCELLED' } } },
      _max: { saleId: true },
    }),
  ]);

  const productIdsWithSales = lastSaleByProduct.map((s) => s.productId);
  const lastSaleDates = productIdsWithSales.length > 0
    ? await db.saleItem.findMany({
        where: {
          productId: { in: productIdsWithSales },
          sale: { shopId: ctx.shopId, status: { not: 'CANCELLED' } },
        },
        select: { productId: true, sale: { select: { date: true } } },
        orderBy: { sale: { date: 'desc' } },
      })
    : [];

  const lastSaleDateMap = new Map<string, Date>();
  for (const item of lastSaleDates) {
    if (!lastSaleDateMap.has(item.productId)) lastSaleDateMap.set(item.productId, item.sale.date);
  }

  const now = new Date();
  const DEAD_STOCK_DAYS = 90;
  let totalCostValue = 0, totalRetailValue = 0, totalUnits = 0, deadStockCount = 0, deadStockValue = 0;

  const items = products.map((p: any) => {
    const costPrice    = toNumber(p.costPrice);
    const salePrice    = toNumber(p.salePrice);
    const currentStock = warehouseId ? (p.warehouseStocks?.[0]?.quantity || 0) : p.stock;
    const stockValueCost   = money.multiply(costPrice, currentStock);
    const stockValueRetail = money.multiply(salePrice, currentStock);
    const margin = salePrice > 0 ? money.round(((salePrice - costPrice) / salePrice) * 100, 1) : 0;
    const lastSoldDate = lastSaleDateMap.get(p.id) || null;
    const daysSinceLastSale = lastSoldDate
      ? Math.floor((now.getTime() - lastSoldDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const isDead = p.stock > 0 && (daysSinceLastSale === null || daysSinceLastSale >= DEAD_STOCK_DAYS);

    totalCostValue   = money.add(totalCostValue, stockValueCost);
    totalRetailValue = money.add(totalRetailValue, stockValueRetail);
    totalUnits += currentStock;
    if (isDead && currentStock > 0) { deadStockCount++; deadStockValue = money.add(deadStockValue, stockValueCost); }

    return {
      id: p.id, name: p.name, sku: p.sku || '', category: p.category || '',
      costPrice, salePrice, stock: currentStock, stockValueCost, stockValueRetail, margin,
      lastSoldDate: lastSoldDate?.toISOString().split('T')[0] || null,
      daysSinceLastSale, isDead, isLowStock: p.isLowStock,
    };
  });

  return {
    summary: {
      totalCostValue, totalRetailValue,
      potentialProfit: money.subtract(totalRetailValue, totalCostValue),
      totalItems: products.length, totalUnits, deadStockCount, deadStockValue,
    },
    items,
  };
}

export async function getInventoryTurnover(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext,
  warehouseId?: string
) {
  const { start, end } = resolveDateRange(startDate, endDate);
  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const [cogsAggregate, products] = await Promise.all([
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' },
        ...(warehouseId && { items: { some: { warehouseId } } }),
      },
      _sum: { totalCost: true },
    }),
    warehouseId
      ? db.warehouseStock.findMany({
          where: { warehouseId },
          select: { quantity: true, product: { select: { costPrice: true } } },
        })
      : db.product.findMany({
          where: { shopId: ctx.shopId, isActive: true, stock: { gt: 0 } },
          select: { costPrice: true, stock: true },
        }),
  ] as any);

  const cogs = toNumber(cogsAggregate._sum.totalCost);
  const avgInventoryValue = warehouseId
    ? (products as any[]).reduce((sum, ws) => money.add(sum, money.multiply(toNumber(ws.product?.costPrice), ws.quantity)), 0)
    : (products as any[]).reduce((sum, p) => money.add(sum, money.multiply(toNumber(p.costPrice), p.stock)), 0);

  const turnoverRate = avgInventoryValue > 0 ? money.round(cogs / avgInventoryValue, 2) : 0;
  const daysSalesOfInventory = turnoverRate > 0 ? Math.round(periodDays / turnoverRate) : 0;

  return {
    period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], days: periodDays },
    cogs, avgInventoryValue, turnoverRate, daysSalesOfInventory,
  };
}

export async function getInventoryIntelligence(windowDays = 30, ctx: RequestContext): Promise<InventoryIntelligence> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const [products, saleStats] = await Promise.all([
    db.product.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, costPrice: true, salePrice: true, category: true },
    }),
    db.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { shopId: ctx.shopId, date: { gte: windowStart }, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true, subtotal: true },
    }),
  ]);

  const statsMap   = new Map(saleStats.map((s) => [s.productId, s]));
  const totalValue = products.reduce((sum, p) => sum + (p.stock * toNumber(p.costPrice)), 0);

  const enriched = products.map((p) => {
    const stats = statsMap.get(p.id);
    const qtySold = stats?._sum.quantity || 0;
    return {
      ...p,
      qtySold,
      revenue: toNumber(stats?._sum.subtotal || 0),
      avgDailySales: qtySold / windowDays,
      stockValue: p.stock * toNumber(p.costPrice),
    };
  });

  const revenueSorted = [...enriched].sort((a, b) => b.revenue - a.revenue);
  const starCount = Math.max(1, Math.ceil(enriched.length * ANALYTICS_THRESHOLDS.STAR_PERCENTILE));

  return {
    stars:    revenueSorted.slice(0, starCount).filter((p) => p.revenue > 0),
    sluggish: enriched.filter((p) => p.qtySold === 0 && p.stock > 0).sort((a, b) => b.stockValue - a.stockValue),
    critical: enriched.filter((p) => p.stock <= p.minStock && p.avgDailySales > 0).sort((a, b) => b.avgDailySales - a.avgDailySales),
    metadata: { totalValue, windowDays },
  };
}

export async function getReorderSuggestions(ctx: RequestContext) {
  const windowDays = 30;
  const targetCoverageDays = 30;
  const safetyBufferDays = 3;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const [products, saleStats, aging] = await Promise.all([
    db.product.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      select: {
        id: true, name: true, sku: true, stock: true, minStock: true,
        costPrice: true, packagingQty: true, moq: true, avgLeadTime: true,
        supplierId: true, category: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
    db.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { shopId: ctx.shopId, date: { gte: windowStart }, status: { not: 'CANCELLED' } } },
      _sum: { quantity: true },
    }),
    getProcurementAging(10, ctx),
  ]);

  const statsMap = new Map((saleStats || []).map((s) => [s.productId, s]));
  const supplierLeadTimeMap = new Map(
    ((aging as any)?.supplierPerformance || []).map((s: any) => [s.supplierName, s.avgLeadTime])
  );

  const urgencyScore: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

  const suggestions = products.map((p) => {
    const stats = statsMap.get(p.id);
    const qtySold = (stats as any)?._sum?.quantity || 0;
    const avgDailySales = qtySold / windowDays;
    const histLeadTime = p.supplier ? supplierLeadTimeMap.get(p.supplier.name) : undefined;
    const effectiveLeadTime = Number(p.avgLeadTime || histLeadTime || 7);
    const reorderThresholdDays = effectiveLeadTime + safetyBufferDays;
    const daysRemaining = avgDailySales > 0 ? (p.stock / avgDailySales) : Infinity;
    const isUrgent = p.stock <= p.minStock || (daysRemaining !== Infinity && daysRemaining <= reorderThresholdDays);

    if (!isUrgent && p.stock > p.minStock) return null;

    const packSize = p.packagingQty || 1;
    const needed = (avgDailySales * targetCoverageDays) - p.stock;
    const suggestedUnits = Math.ceil(Math.max(needed, p.moq || 0, 1) / packSize) * packSize;

    let reason = '';
    if (p.stock <= 0) reason = 'สต็อกหมดแล้ว';
    else if (p.stock <= p.minStock) reason = 'ต่ำกว่าจุดสั่งซื้อ (Min Stock)';
    else if (daysRemaining !== Infinity && daysRemaining <= reorderThresholdDays)
      reason = `ใกล้รันเอาท์ (เหลือพอขาย ${Math.round(daysRemaining)} วัน)`;
    else reason = 'แนะนำให้สั่งซื้อเพื่อรักษาระดับสต็อก';

    return {
      productId: p.id, name: p.name, sku: p.sku || '', category: p.category,
      currentStock: p.stock, avgDailySales,
      daysRemaining: daysRemaining === Infinity ? null : Math.round(daysRemaining),
      reorderThresholdDays, suggestedUnits, suggestedCtn: suggestedUnits / packSize, packSize,
      costPrice: Number(p.costPrice || 0), supplierId: p.supplierId,
      vendorName: p.supplier?.name || 'ไม่มีผู้จำหน่ายหลัก', reason,
      urgency: p.stock <= 0 ? 'CRITICAL' : (daysRemaining !== Infinity && daysRemaining <= effectiveLeadTime ? 'HIGH' : 'MEDIUM'),
    };
  }).filter(Boolean);

  return (suggestions as any[]).sort((a: any, b: any) => {
    if (urgencyScore[a.urgency] !== urgencyScore[b.urgency]) return urgencyScore[a.urgency] - urgencyScore[b.urgency];
    return (a.daysRemaining || 999) - (b.daysRemaining || 999);
  });
}
