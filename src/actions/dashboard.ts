"use server";

import { db } from "@/lib/db";
import {
  requireAuth,
  getCurrentUserId,
  requirePermission,
} from "@/lib/auth-guard";

export async function getDashboardStats() {
  // Use a permission that represents general dashboard access, e.g., SALE_VIEW or just requireAuth if basic
  // Since it shows sales and stock, let's use SALE_VIEW as a baseline or checks permissions context
  // But for now, let's assume if you are a shop member you can see dashboard?
  // Better to use specific permission if strict. Let's use SALE_VIEW for now.
  const ctx = await requirePermission("SALE_VIEW");
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
    // Today's sales summary (aggregate is already optimal)
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: today, lt: tomorrow },
        status: { not: "CANCELLED" },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),

    // Total products count (simple indexed count)
    db.product.count({
      where: { shopId: ctx.shopId, isActive: true },
    }),

    // OPTIMIZED: Low stock count using indexed isLowStock field
    // Before: O(n) fetch all → filter in JS
    // After: O(1) indexed count
    db.product.count({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        isLowStock: true,  // Uses @@index([shopId, isLowStock])
      },
    }),

    // OPTIMIZED: Recent sales with select (only needed fields)
    db.sale.findMany({
      where: { 
        shopId: ctx.shopId,
        status: { not: "CANCELLED" },  // Only show active sales
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

    // ✅ OPTIMIZED: Low stock products using indexed isLowStock field
    // Before: fetch 10 → filter to 5 in JS
    // After: Direct indexed query with take 5
    db.product.findMany({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        isLowStock: true,  // Uses @@index([shopId, isLowStock])
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
      customerName: sale.customer?.name || sale.customerName || "ลูกค้าทั่วไป",
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
  const ctx = await requirePermission("SALE_VIEW");
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  );

  const monthlySales = await db.sale.aggregate({
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
  });

  return {
    revenue: Number(monthlySales._sum.totalAmount || 0),
    profit: Number(monthlySales._sum.profit || 0),
    count: monthlySales._count,
  };
}

export async function getSalesChartData(days = 7) {
  const ctx = await requirePermission("SALE_VIEW");
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const sales = await db.sale.findMany({
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
  });

  // Aggregate by date
  const salesByDate: Record<string, number> = {};

  // Initialize all days with 0
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    // Format as DD/MM (Thai format expectation)
    const dateStr = d.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
    });
    salesByDate[dateStr] = 0;
  }

  // Sum up sales
  sales.forEach((sale) => {
    const dateStr = sale.date.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
    });
    if (salesByDate[dateStr] !== undefined) {
      salesByDate[dateStr] += Number(sale.totalAmount);
    }
  });

  return Object.entries(salesByDate).map(([date, revenue]) => ({
    date,
    revenue,
  }));
}
