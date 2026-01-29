'use server';

import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { logger } from '@/lib/logger';

// Interface สำหรับ Return Data ไปหน้าบ้าน
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
  sales: any[]; 
  expenses: any[]; 
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
    // เริ่มยิง Database พร้อมกัน 4 Query (เพื่อความเร็ว)
    // =========================================================
    const [salesData, expensesData, salesAggregate, expensesAggregate] = await Promise.all([
      
      // Query 1: ดึงรายการขายทั้งหมดในช่วงเวลา
      // ใช้ select เพื่อดึงเฉพาะ field ที่จำเป็น (ลดขนาดข้อมูล)
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          status: { not: 'CANCELLED' }, // ไม่เอารายการที่ยกเลิก
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
          deletedAt: null, // ไม่เอาที่ลบไปแล้ว
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

      // Query 3: หาผลรวมยอดขายและต้นทุน (Server-side Calculation)
      // ใช้ database บวกเลขให้เลย เร็วกว่าเอามาวน loop เอง
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true, totalCost: true },
      }),

      // Query 4: หาผลรวมค่าใช้จ่าย
      db.expense.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: start, lte: end },
          deletedAt: null,
        },
        _sum: { amount: true },
      }),
    ]);

    // แปลงข้อมูลจาก Aggregate (Decimal -> Number)
    const totalSales = Number(salesAggregate._sum.totalAmount || 0);
    const totalCost = Number(salesAggregate._sum.totalCost || 0);
    const totalExpenses = Number(expensesAggregate._sum.amount || 0);
    
    // คำนวณกำไรสุทธิ (ยอดขาย - ต้นทุน - ค่าใช้จ่าย)
    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpenses;

    // =========================================================
    // การจัดกลุ่มข้อมูลรายวัน (Grouping Logic)
    // =========================================================
    const dailyMap = new Map<string, { sales: number; cost: number; expenses: number }>();

    // วนลูปยอดขายเพื่อใส่ลงใน Map รายวัน
    salesData.forEach(s => {
      const dateKey = s.date.toISOString().split('T')[0]; // ตัดเวลาออก เอาแค่วันที่
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0 };
      current.sales += Number(s.totalAmount);
      current.cost += Number(s.totalCost);
      dailyMap.set(dateKey, current);
    });

    // วนลูปค่าใช้จ่ายเพื่อใส่ลงใน Map รายวัน
    expensesData.forEach(e => {
      const dateKey = e.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || { sales: 0, cost: 0, expenses: 0 };
      current.expenses += Number(e.amount);
      dailyMap.set(dateKey, current);
    });

    // แปลง Map เป็น Array เพื่อส่งกลับไปแสดงผลกราฟ
    const dailyStats = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        sales: stats.sales,
        cost: stats.cost,
        expenses: stats.expenses,
        profit: (stats.sales - stats.cost) - stats.expenses
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // เรียงวันที่

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
      sales: salesData.map(s => ({
        ...s,
        totalAmount: Number(s.totalAmount),
        totalCost: Number(s.totalCost),
        profit: Number(s.profit),
      })),
      expenses: expensesData.map(e => ({
          ...e,
          amount: Number(e.amount),
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