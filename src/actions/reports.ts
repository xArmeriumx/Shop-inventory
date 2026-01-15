'use server';

import { db } from '@/lib/db';
import { getCurrentUserId, requirePermission } from '@/lib/auth-guard';

export interface ReportData {
  period: { start: string; end: string };
  summary: {
    totalSales: number;
    totalCost: number;
    totalExpenses: number;
    netProfit: number;
  };
  dailyStats: {
    date: string;
    sales: number;
    cost: number;
    expenses: number;
    profit: number;
  }[];
  sales: any[]; // Detailed sales
  expenses: any[]; // Detailed expenses
}

export async function getReportData(startDate?: string, endDate?: string): Promise<ReportData> {
  const ctx = await requirePermission('REPORT_VIEW_SALES');
  
  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  // Ensure start has time 00:00:00 and end has 23:59:59
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const [sales, expenses] = await Promise.all([
    // Get Sales
    db.sale.findMany({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    }),

    // Get Expenses
    db.expense.findMany({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Calculate Summary
  const totalSales = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const totalCost = sales.reduce((sum, s) => sum + Number(s.totalCost), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // Calculate Profit
  const grossProfit = totalSales - totalCost;
  const netProfit = grossProfit - totalExpenses;

  // Group by Date for Daily Stats
  const dailyMap = new Map<string, any>();

  // Init days logic (optional: fill all days in range, or just days with data)
  // Here we'll just map existing data
  
  sales.forEach(s => {
    const dateKey = s.date.toISOString().split('T')[0];
    const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0 };
    current.sales += Number(s.totalAmount);
    current.cost += Number(s.totalCost);
    dailyMap.set(dateKey, current);
  });

  expenses.forEach(e => {
    const dateKey = e.date.toISOString().split('T')[0];
    const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0 };
    current.expenses += Number(e.amount);
    dailyMap.set(dateKey, current);
  });

  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({
      date,
      sales: stats.sales,
      cost: stats.cost,
      expenses: stats.expenses,
      profit: (stats.sales - stats.cost) - stats.expenses
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
      netProfit
    },
    dailyStats,
    sales,
    expenses
  };
}
