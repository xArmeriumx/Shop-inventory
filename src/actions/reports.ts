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