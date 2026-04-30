/**
 * customer-report.query.ts — Customer & expense analysis queries
 * Responsibilities: customer ranking (RFM lite), expense breakdown by category
 */
import { db } from '@/lib/db';
import { money, toNumber } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { resolveDateRange, resolvePrevPeriod, pctChange } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer Ranking Report — top spenders with avg order value
 */
export async function getCustomerRankingReport(
  startDate: string | undefined,
  endDate: string | undefined,
  limit = 20,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);

  const sales = await db.sale.findMany({
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
      customerId: { not: null },
    },
    select: {
      customerId: true, netAmount: true, profit: true, date: true,
      customer: { select: { id: true, name: true, phone: true } },
    },
  });

  const customerMap = new Map<string, {
    id: string; name: string; phone: string | null;
    totalSpent: number; totalProfit: number; orderCount: number; lastOrderDate: Date;
  }>();

  for (const sale of sales) {
    if (!sale.customerId || !sale.customer) continue;
    const amount  = toNumber(sale.netAmount);
    const profit  = toNumber(sale.profit);
    const existing = customerMap.get(sale.customerId);

    if (existing) {
      existing.totalSpent  = money.add(existing.totalSpent, amount);
      existing.totalProfit = money.add(existing.totalProfit, profit);
      existing.orderCount++;
      if (sale.date > existing.lastOrderDate) existing.lastOrderDate = sale.date;
    } else {
      customerMap.set(sale.customerId, {
        id: sale.customer.id, name: sale.customer.name, phone: sale.customer.phone,
        totalSpent: amount, totalProfit: profit, orderCount: 1, lastOrderDate: sale.date,
      });
    }
  }

  const ranked    = Array.from(customerMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
  const grandTotal = ranked.reduce((sum, c) => money.add(sum, c.totalSpent), 0);

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalCustomers: customerMap.size,
    grandTotal,
    customers: ranked.map((c, i) => ({
      rank: i + 1, ...c,
      avgOrderValue: c.orderCount > 0 ? money.round(c.totalSpent / c.orderCount) : 0,
      percentage: grandTotal > 0 ? money.round((c.totalSpent / grandTotal) * 100, 1) : 0,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Expense Breakdown by Category with period-over-period change
 */
export async function getExpenseByCategoryReport(
  startDate: string | undefined,
  endDate: string | undefined,
  ctx: RequestContext
) {
  const { start, end } = resolveDateRange(startDate, endDate);
  const { prevStart, prevEnd } = resolvePrevPeriod(start, end);

  const [currentByCategory, previousByCategory, currentTotal, previousTotal] = await Promise.all([
    db.expense.groupBy({
      by: ['category'],
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),
    db.expense.groupBy({
      by: ['category'],
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, deletedAt: null },
      _sum: { amount: true }, _count: true,
    }),
    db.expense.aggregate({
      where: { shopId: ctx.shopId, date: { gte: start, lte: end }, deletedAt: null },
      _sum: { amount: true }, _count: true,
    }),
    db.expense.aggregate({
      where: { shopId: ctx.shopId, date: { gte: prevStart, lte: prevEnd }, deletedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const total     = toNumber(currentTotal._sum.amount);
  const prevTotal = toNumber(previousTotal._sum.amount);
  const prevMap   = new Map(previousByCategory.map((p: any) => [p.category, toNumber(p._sum.amount)]));

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    total,
    totalChange: pctChange(total, prevTotal),
    count: currentTotal._count,
    categories: currentByCategory.map((g: any) => {
      const amount     = toNumber(g._sum.amount);
      const prevAmount = prevMap.get(g.category) || 0;
      return {
        category: g.category, amount, count: g._count,
        percentage: total > 0 ? money.round((amount / total) * 100, 1) : 0,
        change: pctChange(amount, prevAmount),
      };
    }),
  };
}
