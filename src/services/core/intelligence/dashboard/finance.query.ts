import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { money, toNumber } from '@/lib/money';

export const DashboardFinanceQuery = {
  async getMonthlyStats(ctx: RequestContext, warehouseId?: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let monthSaleIds: string[] | undefined = undefined;
    if (warehouseId) {
      const matchingSales = await db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: { not: "CANCELLED" },
          items: { some: { warehouseId } },
        },
        select: { id: true },
      });
      monthSaleIds = matchingSales.map(s => s.id);
    }

    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [monthlySales, monthlyIncomes] = await Promise.all([
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: { not: "CANCELLED" },
          ...idFilter(monthSaleIds),
        },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      (db as any).income.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const salesRevenue = toNumber(monthlySales._sum?.netAmount);
    const incomeRevenue = toNumber(monthlyIncomes._sum?.amount);
    const totalRevenue = money.add(salesRevenue, incomeRevenue);

    return {
      revenue: totalRevenue,
      salesRevenue,
      incomeRevenue,
      profit: toNumber(monthlySales._sum?.profit),
      count: monthlySales._count,
      incomeCount: monthlyIncomes._count,
    };
  },

  async getSalesChartData(days = 7, ctx: RequestContext, warehouseId?: string) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    let chartSaleIds: string[] | undefined = undefined;
    if (warehouseId) {
      const matchingSales = await db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          items: { some: { warehouseId } },
        },
        select: { id: true },
      });
      chartSaleIds = matchingSales.map(s => s.id);
    }

    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [sales, incomes] = await Promise.all([
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          ...idFilter(chartSaleIds),
        },
        select: { date: true, netAmount: true },
        orderBy: { date: "asc" },
      }),
      (db as any).income.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        select: { date: true, amount: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const revenueByDate: Record<string, { sales: number; income: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      revenueByDate[dateStr] = { sales: 0, income: 0 };
    }

    sales.forEach((sale: any) => {
      const dateStr = sale.date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      if (revenueByDate[dateStr] !== undefined) {
        revenueByDate[dateStr].sales = money.add(revenueByDate[dateStr].sales, toNumber(sale.netAmount));
      }
    });

    incomes.forEach((inc: any) => {
      const dateStr = inc.date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      if (revenueByDate[dateStr] !== undefined) {
        revenueByDate[dateStr].income = money.add(revenueByDate[dateStr].income, toNumber(inc.amount));
      }
    });

    return Object.entries(revenueByDate).map(([date, data]) => ({
      date,
      revenue: money.add(data.sales, data.income),
      salesRevenue: data.sales,
      incomeRevenue: data.income,
    }));
  }
};
