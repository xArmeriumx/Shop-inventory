import { db } from '@/lib/db';
import { RequestContext, ServiceError } from './product.service';
import { money, toNumber } from '@/lib/money';

export const DashboardService = {
  async getDashboardStats(ctx: RequestContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaySales,
      todayIncomes,
      totalProducts,
      lowStockCount,
      recentSales,
      lowStockProducts,
      pendingPayments,
      pendingShipments,
      todayExpenses,
      stockProducts,
    ] = await Promise.all([
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
        },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      (db as any).income.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: today, lt: tomorrow },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.product.count({
        where: { shopId: ctx.shopId, isActive: true },
      }),
      db.product.count({
        where: { shopId: ctx.shopId, isActive: true, isLowStock: true },
      }),
      db.sale.findMany({
        where: { shopId: ctx.shopId, status: { not: "CANCELLED" } },
        select: {
          id: true, invoiceNumber: true, date: true, customerName: true,
          totalAmount: true, profit: true, customer: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.product.findMany({
        where: { shopId: ctx.shopId, isActive: true, isLowStock: true },
        select: { id: true, name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
        take: 5,
      }),
      Promise.resolve({ _count: 0, _sum: { netAmount: null } }),
      db.shipment.count({
        where: { shopId: ctx.shopId, status: "PENDING" },
      }),
      db.expense.aggregate({
        where: {
          shopId: ctx.shopId, date: { gte: today, lt: tomorrow }, deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.product.findMany({
        where: { shopId: ctx.shopId, isActive: true, stock: { gt: 0 } },
        select: { costPrice: true, stock: true },
      }),
    ]);

    const salesRevenue = toNumber(todaySales._sum?.netAmount);
    const incomeRevenue = toNumber(todayIncomes._sum?.amount);
    const totalRevenue = money.add(salesRevenue, incomeRevenue);
    const salesProfit = toNumber(todaySales._sum?.profit);

    const totalStockValue = stockProducts.reduce(
      (sum: number, p: any) => money.add(sum, money.multiply(toNumber(p.costPrice), p.stock)),
      0
    );

    return {
      todaySales: {
        revenue: totalRevenue,
        salesRevenue,
        incomeRevenue,
        profit: salesProfit,
        count: todaySales._count,
        incomeCount: todayIncomes._count,
      },
      totalProducts,
      lowStockCount,
      recentSales: recentSales.map((sale: any) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        date: sale.date,
        customerName: sale.customer?.name || sale.customerName || "Walk-in",
        totalAmount: toNumber(sale.totalAmount),
        profit: toNumber(sale.profit),
      })),
      lowStockProducts: lowStockProducts.map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        minStock: product.minStock,
      })),
      pendingPayments: { count: 0, amount: 0 },
      pendingShipments,
      todayExpenses: {
        total: toNumber(todayExpenses._sum?.amount),
        count: todayExpenses._count,
      },
      stockValue: {
        total: totalStockValue,
        itemCount: stockProducts.length,
      },
    };
  },

  async getMonthlyStats(ctx: RequestContext) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [monthlySales, monthlyIncomes] = await Promise.all([
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: { not: "CANCELLED" },
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

  async getSalesChartData(days = 7, ctx: RequestContext) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const [sales, incomes] = await Promise.all([
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
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
