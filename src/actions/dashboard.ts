'use server';

import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth-guard';

export async function getDashboardStats() {
  const userId = await getCurrentUserId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todaySales,
    totalProducts,
    lowStockCount,
    recentSales,
    lowStockProducts,
  ] = await Promise.all([
    // Today's sales summary
    db.sale.aggregate({
      where: {
        userId,
        date: { gte: today, lt: tomorrow },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),

    // Total products count
    db.product.count({
      where: { userId, isActive: true },
    }),

    // Low stock products count
    db.product.count({
      where: {
        userId,
        isActive: true,
      },
    }).then(async () => {
      const products = await db.product.findMany({
        where: { userId, isActive: true },
        select: { stock: true, minStock: true },
      });
      return products.filter((p) => p.stock <= p.minStock).length;
    }),

    // Recent sales (last 5)
    db.sale.findMany({
      where: { userId },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: 5,
    }),

    // Low stock products (top 5)
    db.product.findMany({
      where: { userId, isActive: true },
      orderBy: { stock: 'asc' },
      take: 10,
    }).then((products) => {
      return products.filter((p) => p.stock <= p.minStock).slice(0, 5);
    }),
  ]);

  return {
    todaySales: {
      revenue: Number(todaySales._sum.totalAmount || 0),
      profit: Number(todaySales._sum.profit || 0),
      count: todaySales._count,
    },
    totalProducts,
    lowStockCount,
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date,
      customerName: sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป',
      totalAmount: Number(sale.totalAmount),
      profit: Number(sale.profit),
    })),
    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      minStock: product.minStock,
    })),
  };
}

export async function getMonthlyStats() {
  const userId = await getCurrentUserId();
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlySales = await db.sale.aggregate({
    where: {
      userId,
      date: {
        gte: firstDayOfMonth,
        lt: firstDayOfNextMonth,
      },
    },
    _sum: { totalAmount: true, profit: true },
    _count: true,
  });

  return {
    revenue: Number(monthlySales._sum.totalAmount || 0),
    profit: Number(monthlySales._sum.profit || 0),
    count: monthlySales._count,
  };
}

export async function getSalesChartData(days = 7) {
  const userId = await getCurrentUserId();
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const sales = await db.sale.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
      totalAmount: true,
    },
    orderBy: { date: 'asc' },
  });

  // Aggregate by date
  const salesByDate: Record<string, number> = {};
  
  // Initialize all days with 0
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    // Format as DD/MM (Thai format expectation)
    const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
    salesByDate[dateStr] = 0;
  }

  // Sum up sales
  sales.forEach(sale => {
    const dateStr = sale.date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
    if (salesByDate[dateStr] !== undefined) {
      salesByDate[dateStr] += Number(sale.totalAmount);
    }
  });

  return Object.entries(salesByDate).map(([date, revenue]) => ({
    date,
    revenue,
  }));
}
