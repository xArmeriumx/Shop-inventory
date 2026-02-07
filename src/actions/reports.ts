'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';
import { money, toNumber, calcProfit } from '@/lib/money';

// Interface สำหรับ Return Data ไปหน้าบ้าน
export interface ReportData {
  period: { start: string; end: string };
  summary: {
    totalSales: number;
    totalCost: number;
    totalExpenses: number;
    totalIncomes: number;  // Added: Income from other sources
    grossProfit: number;   // Sales - Cost
    netProfit: number;     // Gross - Expenses + Incomes
  };
  dailyStats: {
    date: string;
    sales: number;
    cost: number;
    expenses: number;
    incomes: number;    // Added
    profit: number;
  }[];
  sales: any[]; 
  expenses: any[];
  incomes: any[];  // Added
}

// ฟังก์ชันหลักดึงรายงาน (ระบุช่วงวันที่ได้)
export async function getReportData(startDate?: string, endDate?: string): Promise<ReportData> {
  try {
    const ctx = await requirePermission('REPORT_VIEW_SALES');
    
    // ตั้งค่าช่วงเวลา (ถ้าไม่ส่งมา ให้ใช้เดือนปัจจุบัน)
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // บังคับเวลาเริ่มเป็น 00:00:00 และจบที่ 23:59:59
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // =========================================================
    // เริ่มยิง Database พร้อมกัน 6 Query (เพิ่ม Income Query)
    // =========================================================
    const [salesData, expensesData, incomesData, salesAggregate, expensesAggregate, incomesAggregate] = await Promise.all([
      
      // Query 1: ดึงรายการขายทั้งหมดในช่วงเวลา
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
          totalCost: true,
          profit: true,
          paymentMethod: true,
          customerName: true,
          customer: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
      }),

      // Query 2: ดึงรายการค่าใช้จ่ายทั้งหมดในช่วงเวลา
      db.expense.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        select: {
          id: true,
          date: true,
          category: true,
          amount: true,
          description: true,
        },
        orderBy: { date: 'asc' },
      }),

      // Query 3: ดึงรายการรายได้อื่นๆ (Income)
      (db as any).income.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        select: {
          id: true,
          date: true,
          category: true,
          amount: true,
          description: true,
        },
        orderBy: { date: 'asc' },
      }),

      // Query 4: หาผลรวมยอดขายและต้นทุน
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true, totalCost: true },
      }),

      // Query 5: หาผลรวมค่าใช้จ่าย
      db.expense.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),

      // Query 6: หาผลรวมรายได้อื่นๆ (Income)
      (db as any).income.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    // แปลงข้อมูลจาก Aggregate (Decimal -> Number)
    const totalSales = toNumber(salesAggregate._sum.totalAmount);
    const totalCost = toNumber(salesAggregate._sum.totalCost);
    const totalExpenses = toNumber(expensesAggregate._sum.amount);
    const totalIncomes = toNumber(incomesAggregate._sum.amount);
    
    // คำนวณกำไร
    const grossProfit = calcProfit(totalSales, totalCost);  // กำไรขั้นต้น
    const netProfit = money.add(calcProfit(grossProfit, totalExpenses), totalIncomes);  // กำไรสุทธิ (รวมรายได้อื่นๆ)

    // =========================================================
    // การจัดกลุ่มข้อมูลรายวัน (Grouping Logic)
    // =========================================================
    const dailyMap = new Map<string, { sales: number; cost: number; expenses: number; incomes: number }>();

    // วนลูปยอดขายเพื่อใส่ลงใน Map รายวัน
    salesData.forEach(s => {
      const dateKey = s.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.sales = money.add(current.sales, toNumber(s.totalAmount));
      current.cost = money.add(current.cost, toNumber(s.totalCost));
      dailyMap.set(dateKey, current);
    });

    // วนลูปค่าใช้จ่ายเพื่อใส่ลงใน Map รายวัน
    expensesData.forEach(e => {
      const dateKey = e.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.expenses = money.add(current.expenses, toNumber(e.amount));
      dailyMap.set(dateKey, current);
    });

    // วนลูปรายได้อื่นๆ (Income) เพื่อใส่ลงใน Map รายวัน
    incomesData.forEach((inc: any) => {
      const dateKey = inc.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0, incomes: 0 };
      current.incomes = money.add(current.incomes, toNumber(inc.amount));
      dailyMap.set(dateKey, current);
    });

    // แปลง Map เป็น Array เพื่อส่งกลับไปแสดงผลกราฟ
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        sales: stats.sales,
        cost: stats.cost,
        expenses: stats.expenses,
        incomes: stats.incomes,
        // กำไร = (ยอดขาย - ต้นทุน) - ค่าใช้จ่าย + รายได้อื่นๆ
        profit: money.add(calcProfit(calcProfit(stats.sales, stats.cost), stats.expenses), stats.incomes)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        totalSales,
        totalCost,
        totalExpenses,
        totalIncomes,
        grossProfit,
        netProfit
      },
      dailyStats,
      sales: salesData.map(s => ({
        ...s,
        customerName: s.customer?.name || s.customerName || 'ลูกค้าทั่วไป',
        totalAmount: toNumber(s.totalAmount),
        totalCost: toNumber(s.totalCost),
        profit: toNumber(s.profit),
      })),
      expenses: expensesData.map(e => ({
          ...e,
          amount: toNumber(e.amount),
      })),
      incomes: incomesData.map((inc: any) => ({
        ...inc,
        amount: toNumber(inc.amount),
      }))
    };
  } catch (error: any) {
    await logger.error('Failed to generate report data', error, { 
      path: 'getReportData', 
      startDate, 
      endDate 
    });
    throw new Error('ไม่สามารถดึงข้อมูลรายงานได้ กรุณาลองใหม่อีกครั้ง');
  }
}

// =============================================================================
// ADVANCED REPORTS
// =============================================================================

/**
 * Top selling products by revenue
 */
export async function getTopProducts(startDate?: string, endDate?: string, limit = 10) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Group sale items by product
  const productStats = await db.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    },
    _sum: {
      subtotal: true,
      quantity: true,
    },
    _count: true,
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  // Fetch product names
  const productIds = productStats.map(p => p.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, costPrice: true },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  return productStats.map(stat => {
    const product = productMap.get(stat.productId);
    const revenue = toNumber(stat._sum.subtotal);
    const qty = stat._sum.quantity || 0;
    const costPrice = toNumber(product?.costPrice);
    const estimatedProfit = revenue - (costPrice * qty);

    return {
      productId: stat.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      quantity: qty,
      revenue,
      estimatedProfit,
      orderCount: stat._count,
    };
  });
}

/**
 * Profit breakdown by product
 */
export async function getProfitByProduct(startDate?: string, endDate?: string) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Get all sale items in period with product info
  const saleItems = await db.saleItem.findMany({
    where: {
      sale: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    },
    select: {
      productId: true,
      quantity: true,
      salePrice: true,
      costPrice: true,
      subtotal: true,
      product: { select: { name: true, sku: true } },
    },
  });

  // Aggregate in-memory by product
  const profitMap = new Map<string, {
    name: string;
    sku: string;
    totalQty: number;
    totalRevenue: number;
    totalCost: number;
  }>();

  saleItems.forEach(item => {
    const key = item.productId;
    const current = profitMap.get(key) || {
      name: item.product?.name || 'Unknown',
      sku: item.product?.sku || '',
      totalQty: 0,
      totalRevenue: 0,
      totalCost: 0,
    };
    current.totalQty += item.quantity;
    current.totalRevenue = money.add(current.totalRevenue, toNumber(item.subtotal));
    current.totalCost = money.add(current.totalCost, money.multiply(toNumber(item.costPrice), item.quantity));
    profitMap.set(key, current);
  });

  return Array.from(profitMap.entries())
    .map(([productId, data]) => ({
      productId,
      ...data,
      profit: calcProfit(data.totalRevenue, data.totalCost),
      margin: data.totalRevenue > 0
        ? Math.round(calcProfit(data.totalRevenue, data.totalCost) / data.totalRevenue * 100)
        : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

/**
 * Compare two periods (e.g., this month vs last month)
 */
export async function getComparisonReport(
  period1Start: string,
  period1End: string,
  period2Start: string,
  period2End: string,
) {
  const ctx = await requirePermission('REPORT_VIEW_SALES');

  const p1Start = new Date(period1Start);
  const p1End = new Date(period1End);
  const p2Start = new Date(period2Start);
  const p2End = new Date(period2End);

  p1Start.setHours(0, 0, 0, 0);
  p1End.setHours(23, 59, 59, 999);
  p2Start.setHours(0, 0, 0, 0);
  p2End.setHours(23, 59, 59, 999);

  const [period1Sales, period2Sales, period1Expenses, period2Expenses] = await Promise.all([
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: p1Start, lte: p1End },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: p2Start, lte: p2End },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalAmount: true, profit: true },
      _count: true,
    }),
    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: p1Start, lte: p1End },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: p2Start, lte: p2End },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const p1Revenue = toNumber(period1Sales._sum.totalAmount);
  const p2Revenue = toNumber(period2Sales._sum.totalAmount);
  const p1Profit = toNumber(period1Sales._sum.profit);
  const p2Profit = toNumber(period2Sales._sum.profit);
  const p1Expenses = toNumber(period1Expenses._sum.amount);
  const p2Expenses = toNumber(period2Expenses._sum.amount);

  const pctChange = (current: number, previous: number) =>
    previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;

  return {
    period1: {
      label: `${p1Start.toISOString().split('T')[0]} — ${p1End.toISOString().split('T')[0]}`,
      revenue: p1Revenue,
      profit: p1Profit,
      expenses: p1Expenses,
      orderCount: period1Sales._count,
    },
    period2: {
      label: `${p2Start.toISOString().split('T')[0]} — ${p2End.toISOString().split('T')[0]}`,
      revenue: p2Revenue,
      profit: p2Profit,
      expenses: p2Expenses,
      orderCount: period2Sales._count,
    },
    changes: {
      revenue: pctChange(p1Revenue, p2Revenue),
      profit: pctChange(p1Profit, p2Profit),
      expenses: pctChange(p1Expenses, p2Expenses),
      orderCount: pctChange(period1Sales._count, period2Sales._count),
    },
  };
}