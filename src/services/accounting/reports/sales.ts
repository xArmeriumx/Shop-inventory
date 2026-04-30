/**
 * sales-report.query.ts — Sales performance queries
 * Responsibilities: general report, comparison, channel breakdown, heatmap
 */
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { money, toNumber, calcProfit } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { resolveDateRange, resolvePrevPeriod, pctChange, ReportData } from './helpers';

export type { ReportData };

// ─────────────────────────────────────────────────────────────────────────────

/**
 * General P&L report: sales, expenses, incomes aggregated by day
 */
export async function getReportData(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
): Promise<ReportData> {
  try {
    const { start, end } = resolveDateRange(startDate, endDate);

    const [salesData, expensesData, incomesData, salesAggregate, expensesAggregate, incomesAggregate] =
      await Promise.all([
        db.sale.findMany({
          where: {
            shopId: ctx.shopId,
            date: { gte: start, lte: end },
            status: { not: 'CANCELLED' },
          },
          select: {
            id: true,
            invoiceNumber: true,
            date: true,
            totalAmount: true,
            netAmount: true,
            totalCost: true,
            profit: true,
            paymentMethod: true,
            customerName: true,
            customer: { select: { name: true } },
          },
          orderBy: { date: 'asc' },
        }),

        db.expense.findMany({
          where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
          select: { id: true, date: true, category: true, amount: true, description: true },
          orderBy: { date: 'asc' },
        }),

        (db as any).income.findMany({
          where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
          select: { id: true, date: true, category: true, amount: true, description: true },
          orderBy: { date: 'asc' },
        }),

        db.sale.aggregate({
          where: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
          _sum: { netAmount: true, totalCost: true },
        }),

        db.expense.aggregate({
          where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
          _sum: { amount: true },
        }),

        (db as any).income.aggregate({
          where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
          _sum: { amount: true },
        }),
      ]);

    const totalSales = toNumber(salesAggregate._sum.netAmount);
    const totalCost = toNumber(salesAggregate._sum.totalCost);
    const totalExpenses = toNumber(expensesAggregate._sum.amount);
    const totalIncomes = toNumber(incomesAggregate._sum.amount);
    const grossProfit = calcProfit(totalSales, totalCost);
    const netProfit = money.add(calcProfit(grossProfit, totalExpenses), totalIncomes);

    // Group by day
    const dailyMap = new Map<string, { sales: number; cost: number; expenses: number; incomes: number }>();

    salesData.forEach((s) => {
      const dateKey = s.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.sales = money.add(current.sales, toNumber(s.netAmount));
      current.cost = money.add(current.cost, toNumber(s.totalCost));
      dailyMap.set(dateKey, current);
    });

    expensesData.forEach((e) => {
      const dateKey = e.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.expenses = money.add(current.expenses, toNumber(e.amount));
      dailyMap.set(dateKey, current);
    });

    incomesData.forEach((inc: any) => {
      const dateKey = inc.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.incomes = money.add(current.incomes, toNumber(inc.amount));
      dailyMap.set(dateKey, current);
    });

    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        sales: stats.sales,
        cost: stats.cost,
        expenses: stats.expenses,
        incomes: stats.incomes,
        profit: money.add(calcProfit(calcProfit(stats.sales, stats.cost), stats.expenses), stats.incomes),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      summary: { totalSales, totalCost, totalExpenses, totalIncomes, grossProfit, netProfit },
      dailyStats,
      sales: salesData.map((s) => ({
        ...s,
        customerName: s.customer?.name || s.customerName || 'ลูกค้าทั่วไป',
        totalAmount: toNumber(s.totalAmount),
        totalCost: toNumber(s.totalCost),
        profit: toNumber(s.profit),
      })),
      expenses: expensesData.map((e) => ({ ...e, amount: toNumber(e.amount) })),
      incomes: incomesData.map((inc: any) => ({ ...inc, amount: toNumber(inc.amount) })),
    };
  } catch (error: any) {
    await logger.error('Failed to generate report data', error, { path: 'getReportData', startDate, endDate });
    throw new Error('ไม่สามารถดึงข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two periods side-by-side (revenue, profit, expenses, order count)
 */
export async function getComparisonReport(
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string,
  ctx: RequestContext
) {
  const p1Start = new Date(period1Start); p1Start.setHours(0, 0, 0, 0);
  const p1End = new Date(period1End);     p1End.setHours(23, 59, 59, 999);
  const p2Start = new Date(period2Start); p2Start.setHours(0, 0, 0, 0);
  const p2End = new Date(period2End);     p2End.setHours(23, 59, 59, 999);

  const [period1Sales, period2Sales, period1Expenses, period2Expenses] = await Promise.all([
    db.sale.aggregate({
      where: { shopId: ctx.shopId, date: { gte: p1Start, lte: p1End }, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true, profit: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { shopId: ctx.shopId, date: { gte: p2Start, lte: p2End }, status: { not: 'CANCELLED' } },
      _sum: { netAmount: true, profit: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: { shopId: ctx.shopId, date: { gte: p1Start, lte: p1End }, deletedAt: null },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { shopId: ctx.shopId, date: { gte: p2Start, lte: p2End }, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const p1Revenue = toNumber(period1Sales._sum.netAmount);
  const p2Revenue = toNumber(period2Sales._sum.netAmount);
  const p1Profit  = toNumber(period1Sales._sum.profit);
  const p2Profit  = toNumber(period2Sales._sum.profit);
  const p1Exp = toNumber(period1Expenses._sum.amount);
  const p2Exp = toNumber(period2Expenses._sum.amount);

  return {
    period1: {
      label: `${p1Start.toISOString().split('T')[0]} — ${p1End.toISOString().split('T')[0]}`,
      revenue: p1Revenue, profit: p1Profit, expenses: p1Exp, orderCount: period1Sales._count,
    },
    period2: {
      label: `${p2Start.toISOString().split('T')[0]} — ${p2End.toISOString().split('T')[0]}`,
      revenue: p2Revenue, profit: p2Profit, expenses: p2Exp, orderCount: period2Sales._count,
    },
    changes: {
      revenue: pctChange(p1Revenue, p2Revenue),
      profit: pctChange(p1Profit, p2Profit),
      expenses: pctChange(p1Exp, p2Exp),
      orderCount: pctChange(period1Sales._count, period2Sales._count),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Revenue/profit breakdown by sales channel (ERP, POS, Shopee, etc.)
 */
export async function getSalesChannelReport(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);

  const channelData = await db.sale.groupBy({
    by: ['channel'],
    where: { shopId: ctx.shopId, date: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    _sum: { netAmount: true, totalCost: true, profit: true },
    _count: true,
    orderBy: { _sum: { netAmount: 'desc' } },
  });

  const totalRevenue = channelData.reduce(
    (sum: number, g: any) => money.add(sum, toNumber(g._sum.netAmount)),
    0
  );

  const channelLabels: Record<string, string> = {
    WALK_IN: 'หน้าร้าน', SHOPEE: 'Shopee', LAZADA: 'Lazada',
    LINE: 'LINE', FACEBOOK: 'Facebook', OTHER: 'อื่นๆ',
  };

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalRevenue,
    channels: channelData.map((g: any) => {
      const revenue = toNumber(g._sum.netAmount);
      const cost    = toNumber(g._sum.totalCost);
      const profit  = toNumber(g._sum.profit);
      return {
        channel: g.channel,
        label: channelLabels[g.channel] || g.channel,
        revenue, cost, profit,
        margin: revenue > 0 ? money.round((profit / revenue) * 100, 1) : 0,
        count: g._count,
        percentage: totalRevenue > 0 ? money.round((revenue / totalRevenue) * 100, 1) : 0,
      };
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * UC 21: Sales Heatmap — category vs time-of-day buckets
 */
export async function getSalesHeatmap(windowDays: number = 30, ctx: RequestContext) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: { shopId: ctx.shopId, date: { gte: windowStart }, status: { not: 'CANCELLED' } },
    },
    select: {
      saleId: true,
      quantity: true,
      subtotal: true,
      product: { select: { category: true } },
      sale: { select: { date: true } },
    },
  });

  const buckets = [
    { id: '08-11', label: '08-11', start: 8, end: 11 },
    { id: '11-14', label: '11-14', start: 11, end: 14 },
    { id: '14-17', label: '14-17', start: 14, end: 17 },
    { id: '17-20', label: '17-20', start: 17, end: 20 },
    { id: 'OTHER', label: 'Other', start: 0, end: 24 },
  ];

  const matrix = new Map<string, Map<string, { revenue: number; bills: Set<string>; items: number }>>();
  const categories = new Set<string>();

  saleItems.forEach((item) => {
    const hour = item.sale.date.getHours();
    const category = item.product?.category || 'Uncategorized';
    categories.add(category);

    let bucketId = 'OTHER';
    for (const b of buckets) {
      if (b.id !== 'OTHER' && hour >= b.start && hour < b.end) { bucketId = b.id; break; }
    }

    if (!matrix.has(category)) matrix.set(category, new Map());
    const catMap = matrix.get(category)!;
    if (!catMap.has(bucketId)) catMap.set(bucketId, { revenue: 0, bills: new Set(), items: 0 });

    const cell = catMap.get(bucketId)!;
    cell.revenue = money.add(cell.revenue, toNumber(item.subtotal));
    cell.items += item.quantity;
    cell.bills.add(item.saleId);
  });

  const data = Array.from(categories).map((cat) => {
    const row: any = { category: cat };
    buckets.forEach((b) => {
      const stats = matrix.get(cat)?.get(b.id);
      row[b.id] = { revenue: stats?.revenue || 0, bills: stats?.bills.size || 0, items: stats?.items || 0 };
    });
    return row;
  });

  return {
    buckets: buckets.map((b) => ({ id: b.id, label: b.label })),
    data: data.sort((a, b) => {
      const aTotal = buckets.reduce((sum, buck) => sum + a[buck.id].revenue, 0);
      const bTotal = buckets.reduce((sum, buck) => sum + b[buck.id].revenue, 0);
      return bTotal - aTotal;
    }),
  };
}
