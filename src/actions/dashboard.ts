"use server";

import { db } from "@/lib/db";
import {
  requireAuth,
  getCurrentUserId,
  requirePermission,
} from "@/lib/auth-guard";
import { money, toNumber } from "@/lib/money";


export async function getDashboardStats() {
 

  const ctx = await requirePermission("SALE_VIEW");

  //Setup Date Range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // list dashboard stats
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
  ] = await Promise.all([

    // Today's sales summary
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),

    // Today's income
    (db as any).income.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Total products count
    db.product.count({
      where: { shopId: ctx.shopId, isActive: true },
    }),

    // Low stock count
    db.product.count({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        isLowStock: true,
      },
    }),

    // Recent sales
    db.sale.findMany({
      where: { 
        shopId: ctx.shopId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        customerName: true,
        totalAmount: true,
        profit: true,
        customer: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),

    // Low stock products
    db.product.findMany({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        isLowStock: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
      },
      orderBy: { stock: "asc" },
      take: 5,
    }),

    // NEW: Pending payment count + amount
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        paymentStatus: "PENDING",
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),

    // NEW: Pending shipments count
    db.shipment.count({
      where: {
        shopId: ctx.shopId,
        status: "PENDING",
      },
    }),

    // NEW: Today's expenses
    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Calculate totals including income
  const salesRevenue = toNumber(todaySales._sum.totalAmount);
  const incomeRevenue = toNumber(todayIncomes._sum.amount);
  const totalRevenue = money.add(salesRevenue, incomeRevenue);
  const salesProfit = toNumber(todaySales._sum.profit);

  //Return dashboard stats (object)
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
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      customerName: sale.customer?.name || sale.customerName || "Walk-in",
      totalAmount: toNumber(sale.totalAmount),
      profit: toNumber(sale.profit),
    })),
    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minStock: product.minStock,
    })),
    // NEW: Action items
    pendingPayments: {
      count: pendingPayments._count,
      amount: toNumber(pendingPayments._sum.totalAmount),
    },
    pendingShipments,
    todayExpenses: {
      total: toNumber(todayExpenses._sum.amount),
      count: todayExpenses._count,
    },
  };
}

//Monthly stats
export async function getMonthlyStats() {
  const ctx = await requirePermission("SALE_VIEW");
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  );

  // Fetch both sales and income
  const [monthlySales, monthlyIncomes] = await Promise.all([
    //Monthly sales summary
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth,
        },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),
    
    //Monthly income summary
    (db as any).income.aggregate({
      where: {
        shopId: ctx.shopId,
        date: {
          gte: firstDayOfMonth,
          lt: firstDayOfNextMonth,
        },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  // Calculate totals including income
  const salesRevenue = toNumber(monthlySales._sum.totalAmount);
  const incomeRevenue = toNumber(monthlyIncomes._sum.amount);
  const totalRevenue = money.add(salesRevenue, incomeRevenue);

  return {
    revenue: totalRevenue,    // Sales + Income
    salesRevenue,             // Just sales
    incomeRevenue,            // Just income
    profit: toNumber(monthlySales._sum.profit),
    count: monthlySales._count,
    incomeCount: monthlyIncomes._count,
  };
}


//Sales chart data
export async function getSalesChartData(days = 7) {
  const ctx = await requirePermission("SALE_VIEW");
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  // Fetch both sales and income
  const [sales, incomes] = await Promise.all([
    db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: "CANCELLED" },
      },
      select: {
        date: true,
        totalAmount: true,
      },
      orderBy: { date: "asc" },
    }),
    
    (db as any).income.findMany({
      where: {
        shopId: ctx.shopId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      select: {
        date: true,
        amount: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // Aggregate by date
  const revenueByDate: Record<string, { sales: number; income: number }> = {};

  // Initialize all days with 0
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    // Format as DD/MM (Thai format expectation)
    const dateStr = d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
    });
    revenueByDate[dateStr] = { sales: 0, income: 0 };
  }

  // Sum up sales
  sales.forEach((sale) => {
    const dateStr = sale.date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
    });
    if (revenueByDate[dateStr] !== undefined) {
      revenueByDate[dateStr].sales = money.add(revenueByDate[dateStr].sales, toNumber(sale.totalAmount));
    }
  });

  // Sum up incomes
  incomes.forEach((inc: any) => {
    const dateStr = inc.date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
    });
    if (revenueByDate[dateStr] !== undefined) {
      revenueByDate[dateStr].income = money.add(revenueByDate[dateStr].income, toNumber(inc.amount));
    }
  });

  //Return sales chart data (array of objects)
  return Object.entries(revenueByDate).map(([date, data]) => ({
    date,
    revenue: money.add(data.sales, data.income),  // Total revenue
    salesRevenue: data.sales,
    incomeRevenue: data.income,
  }));
}
