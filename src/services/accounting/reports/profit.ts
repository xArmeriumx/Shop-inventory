/**
 * profit-report.query.ts — Profit & margin analysis queries
 * Responsibilities: P&L statement, profit by product, top products, sales by category
 */
import { db } from '@/lib/db';
import { money, toNumber, calcProfit } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { resolveDateRange, resolvePrevPeriod, pctChange } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full Profit & Loss Statement with previous-period comparison
 */
export async function getProfitLossReport(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);
  const { prevStart, prevEnd } = resolvePrevPeriod(start, end);

  const [
    salesData, prevSalesData,
    expensesByCategory, prevExpensesTotal,
    incomesData, prevIncomesData,
    purchasesData, prevPurchasesData,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true, totalCost: true, profit: true, discountAmount: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true, totalCost: true, profit: true },
      _count: true,
    }),
    db.expense.groupBy({
      by: ['category'],
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),
    db.expense.aggregate({
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, deletedAt: null },
      _sum: { amount: true },
    }),
    (db as any).income.aggregate({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true },
      _count: true,
    }),
    (db as any).income.aggregate({
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, deletedAt: null },
      _sum: { amount: true },
    }),
    db.purchase.aggregate({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      _sum: { totalCost: true },
      _count: true,
    }),
    db.purchase.aggregate({
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, status: { not: 'CANCELLED' } },
      _sum: { totalCost: true },
    }),
  ]);

  const salesRevenue   = toNumber(salesData._sum.netAmount);
  const cogs           = toNumber(salesData._sum.totalCost);
  const salesDiscount  = toNumber(salesData._sum.discountAmount);
  const otherIncome    = toNumber(incomesData._sum?.amount);
  const totalRevenue   = money.add(salesRevenue, otherIncome);
  const grossProfit    = money.subtract(totalRevenue, cogs);
  const grossMargin    = totalRevenue > 0 ? money.round((grossProfit / totalRevenue) * 100, 1) : 0;

  const totalExpenses  = expensesByCategory.reduce(
    (sum: number, g: any) => money.add(sum, toNumber(g._sum.amount)), 0
  );
  const netProfit  = money.subtract(grossProfit, totalExpenses);
  const netMargin  = totalRevenue > 0 ? money.round((netProfit / totalRevenue) * 100, 1) : 0;

  const prevRevenue    = money.add(toNumber(prevSalesData._sum.netAmount), toNumber(prevIncomesData._sum?.amount));
  const prevExpenses   = toNumber(prevExpensesTotal._sum.amount);
  const prevGrossProfit = money.subtract(toNumber(prevSalesData._sum.netAmount), toNumber(prevSalesData._sum.totalCost));
  const prevNetProfit  = money.subtract(prevGrossProfit, prevExpenses);

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    revenue: {
      sales: salesRevenue, otherIncome, discount: salesDiscount,
      total: totalRevenue, change: pctChange(totalRevenue, prevRevenue),
    },
    cogs, grossProfit, grossMargin,
    expenses: {
      byCategory: expensesByCategory.map((g: any) => ({
        category: g.category,
        amount: toNumber(g._sum.amount),
        count: g._count,
        percentage: totalExpenses > 0
          ? money.round((toNumber(g._sum.amount) / totalExpenses) * 100, 1) : 0,
      })),
      total: totalExpenses,
      change: pctChange(totalExpenses, prevExpenses),
    },
    netProfit, netMargin,
    netProfitChange: pctChange(netProfit, prevNetProfit),
    salesCount: salesData._count,
    incomeCount: incomesData._count || 0,
    purchaseTotal: toNumber(purchasesData._sum.totalCost),
    purchaseCount: purchasesData._count,
    cashIn: totalRevenue,
    cashOut: money.add(toNumber(purchasesData._sum.totalCost), totalExpenses),
    netCashFlow: money.subtract(
      totalRevenue,
      money.add(toNumber(purchasesData._sum.totalCost), totalExpenses)
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Profit breakdown aggregated by product
 */
export async function getProfitByProduct(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    },
    select: {
      productId: true, quantity: true, salePrice: true,
      costPrice: true, subtotal: true,
      product: { select: { name: true, sku: true } },
    },
  });

  const profitMap = new Map<string, {
    name: string; sku: string;
    totalQty: number; totalRevenue: number; totalCost: number;
  }>();

  saleItems.forEach((item) => {
    const current = profitMap.get(item.productId) || {
      name: item.product?.name || 'Unknown',
      sku: item.product?.sku || '',
      totalQty: 0, totalRevenue: 0, totalCost: 0,
    };
    current.totalQty += item.quantity;
    current.totalRevenue = money.add(current.totalRevenue, toNumber(item.subtotal));
    current.totalCost    = money.add(current.totalCost, money.multiply(toNumber(item.costPrice), item.quantity));
    profitMap.set(item.productId, current);
  });

  return Array.from(profitMap.entries())
    .map(([productId, data]) => ({
      productId, ...data,
      profit: calcProfit(data.totalRevenue, data.totalCost),
      margin: data.totalRevenue > 0
        ? Math.round(calcProfit(data.totalRevenue, data.totalCost) / data.totalRevenue * 100) : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Top-selling products by revenue within a period
 */
export async function getTopProducts(
  startDate: string | undefined,
  endDate: string | undefined,
  limit = 10,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);

  const productStats = await db.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    },
    _sum: { subtotal: true, quantity: true, profit: true },
    _count: true,
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  const productIds = productStats.map((p) => p.productId);
  const products   = await db.product.findMany({
    where: { id: { in: productIds }, shopId: ctx.shopId },
    select: { id: true, name: true, sku: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  return productStats.map((stat) => {
    const product = productMap.get(stat.productId);
    return {
      productId: stat.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      quantity: stat._sum.quantity || 0,
      revenue: toNumber(stat._sum.subtotal),
      profit: toNumber(stat._sum.profit),
      orderCount: stat._count,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revenue/profit breakdown by product category
 */
export async function getSalesByCategory(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    },
    select: {
      quantity: true, subtotal: true, costPrice: true,
      product: { select: { category: true } },
    },
  });

  const categoryMap = new Map<string, { revenue: number; cost: number; quantity: number }>();
  let totalRevenue = 0;

  saleItems.forEach((item) => {
    const cat     = item.product?.category || 'ไม่มีหมวดหมู่';
    const current = categoryMap.get(cat) || { revenue: 0, cost: 0, quantity: 0 };
    const revenue = toNumber(item.subtotal);
    const cost    = money.multiply(toNumber(item.costPrice), item.quantity);

    current.revenue  = money.add(current.revenue, revenue);
    current.cost     = money.add(current.cost, cost);
    current.quantity += item.quantity;
    totalRevenue     = money.add(totalRevenue, revenue);
    categoryMap.set(cat, current);
  });

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category, ...data,
      profit: calcProfit(data.revenue, data.cost),
      percentage: totalRevenue > 0
        ? money.round((data.revenue / totalRevenue) * 100, 1) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
