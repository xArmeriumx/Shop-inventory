import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { money, toNumber, calcProfit } from '@/lib/money';
import { RequestContext } from '@/types/domain';
import { calculateCtn } from '@/lib/erp-utils';

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
export async function getReportData(startDate: string | undefined = undefined, endDate: string | undefined = undefined, ctx: RequestContext): Promise<ReportData> {
  try {

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
          netAmount: true,     // ✅ ใช้สำหรับ revenue aggregate (เงินที่ได้รับจริง)
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
        _sum: { netAmount: true, totalCost: true },  // ✅ ใช้ netAmount (หลังส่วนลดบิล)
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
    const totalSales = toNumber(salesAggregate._sum.netAmount);  // ✅ Revenue = เงินที่ได้รับจริง
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
      current.sales = money.add(current.sales, toNumber(s.netAmount));  // ✅ ใช้ netAmount
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
// ERP SPECIALIZED REPORTS (Phase 4)
// =============================================================================

/**
 * UC 14: Currency Conversion (CNY -> USD)
 * UC 16: Freight Charge Allocation
 */
export async function getPurchaseReport(purchaseId: string, exchangeRate: number, ctx: RequestContext) {
  const purchase = await db.purchase.findFirst({
    where: { id: purchaseId, shopId: ctx.shopId },
    include: {
      items: { include: { product: true } },
      supplier: true,
    }
  });

  if (!purchase) throw new Error('ไม่พบข้อมูลการซื้อ');

  const items = purchase.items.map(item => {
    const costCNY = toNumber(item.costPrice);
    // UC 14: Convert to USD
    const costUSD = costCNY / exchangeRate;

    return {
      ...item,
      packagingQty: item.packagingQty || 1,
      ctn: calculateCtn(item.quantity, item.packagingQty || 1),
      costCNY,
      costUSD: Number(costUSD.toFixed(4)),
      subtotalCNY: toNumber(item.subtotal),
      subtotalUSD: Number((toNumber(item.subtotal) / exchangeRate).toFixed(2)),
    };
  });

  // UC 16: Example of Charge Allocation
  // Allocation logic: distribute fixed costs (like freight) across items by value
  const totalValue = items.reduce((sum, i) => sum + i.subtotalCNY, 0);

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    items,
    exchangeRate,
    summary: {
      totalCNY: items.reduce((sum, i) => sum + i.subtotalCNY, 0),
      totalUSD: items.reduce((sum, i) => sum + i.subtotalUSD, 0),
    }
  };
}

/**
 * UC 17: Pagination Summary Logic 
 * Determines if the summary block should be rendered based on page info.
 */
export function getReportLayoutMetadata(currentPage: number, totalPages: number) {
  return {
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    showFooterSummary: currentPage === totalPages, // UC 17: Show net/vat only on last page
  };
}

/**
 * Top selling products by revenue
 */
export async function getTopProducts(startDate: string | undefined, endDate: string | undefined, limit = 10, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Group sale items by product
  // Use SaleItem.profit (snapshotted at sale time) instead of current Product.costPrice
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
      profit: true,  // ✅ ใช้ profit ที่คำนวณไว้ตอน createSale (snapshot)
    },
    _count: true,
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  // Fetch product names (no longer need costPrice)
  const productIds = productStats.map(p => p.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds }, shopId: ctx.shopId },
    select: { id: true, name: true, sku: true },
  });

  const productMap = new Map(products.map(p => [p.id, p]));

  return productStats.map(stat => {
    const product = productMap.get(stat.productId);
    const revenue = toNumber(stat._sum.subtotal);
    const qty = stat._sum.quantity || 0;
    // ✅ ใช้ profit จาก SaleItem โดยตรง — ถูกต้องตามต้นทุน ณ เวลาที่ขายจริง
    const profit = toNumber(stat._sum.profit);

    return {
      productId: stat.productId,
      name: product?.name || 'Unknown',
      sku: product?.sku || '',
      quantity: qty,
      revenue,
      profit,
      orderCount: stat._count,
    };
  });
}

/**
 * Profit breakdown by product
 */
export async function getProfitByProduct(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

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
  ctx: RequestContext
) {

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
      _sum: { netAmount: true, profit: true },  // ✅ ใช้ netAmount
      _count: true,
    }),
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: p2Start, lte: p2End },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, profit: true },  // ✅ ใช้ netAmount
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

  const p1Revenue = toNumber(period1Sales._sum.netAmount);  // ✅ Revenue = เงินที่ได้รับจริง
  const p2Revenue = toNumber(period2Sales._sum.netAmount);
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

// =============================================================================
// STOCK VALUE & INVENTORY KPI REPORTS (Phase 3)
// =============================================================================

/**
 * Stock Value Report with Dead Stock detection
 * Shows per-product stock value and identifies items with no sales in 90+ days
 */
export async function getStockValueReport(ctx: RequestContext) {

  // Parallel fetch: all active products + last sale date per product
  const [products, lastSaleByProduct] = await Promise.all([
    db.product.findMany({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        costPrice: true,
        salePrice: true,
        stock: true,
        minStock: true,
        isLowStock: true,
      },
      orderBy: { name: 'asc' },
    }),

    // Get the most recent sale date for each product
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId: ctx.shopId,
          status: { not: 'CANCELLED' },
        },
      },
      _max: { saleId: true },
    }),
  ]);

  // Fetch actual sale dates for products that have sales
  const productIdsWithSales = lastSaleByProduct.map(s => s.productId);
  const lastSaleDates = productIdsWithSales.length > 0
    ? await db.saleItem.findMany({
      where: {
        productId: { in: productIdsWithSales },
        sale: {
          shopId: ctx.shopId,
          status: { not: 'CANCELLED' },
        },
      },
      select: {
        productId: true,
        sale: { select: { date: true } },
      },
      orderBy: { sale: { date: 'desc' } },
    })
    : [];

  // Build a map of productId -> last sale date  
  const lastSaleDateMap = new Map<string, Date>();
  for (const item of lastSaleDates) {
    if (!lastSaleDateMap.has(item.productId)) {
      lastSaleDateMap.set(item.productId, item.sale.date);
    }
  }

  const now = new Date();
  const DEAD_STOCK_DAYS = 90;

  // Calculate per-product values
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;
  let deadStockCount = 0;
  let deadStockValue = 0;

  const items = products.map(p => {
    const costPrice = toNumber(p.costPrice);
    const salePrice = toNumber(p.salePrice);
    const stockValueCost = money.multiply(costPrice, p.stock);
    const stockValueRetail = money.multiply(salePrice, p.stock);
    const margin = salePrice > 0
      ? money.round(((salePrice - costPrice) / salePrice) * 100, 1)
      : 0;

    const lastSoldDate = lastSaleDateMap.get(p.id) || null;
    const daysSinceLastSale = lastSoldDate
      ? Math.floor((now.getTime() - lastSoldDate.getTime()) / (1000 * 60 * 60 * 24))
      : null; // null = never sold

    const isDead = p.stock > 0 && (daysSinceLastSale === null || daysSinceLastSale >= DEAD_STOCK_DAYS);

    totalCostValue = money.add(totalCostValue, stockValueCost);
    totalRetailValue = money.add(totalRetailValue, stockValueRetail);
    totalUnits += p.stock;

    if (isDead && p.stock > 0) {
      deadStockCount++;
      deadStockValue = money.add(deadStockValue, stockValueCost);
    }

    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: p.category || '',
      costPrice,
      salePrice,
      stock: p.stock,
      stockValueCost,
      stockValueRetail,
      margin,
      lastSoldDate: lastSoldDate?.toISOString().split('T')[0] || null,
      daysSinceLastSale,
      isDead,
      isLowStock: p.isLowStock,
    };
  });

  return {
    summary: {
      totalCostValue,
      totalRetailValue,
      potentialProfit: money.subtract(totalRetailValue, totalCostValue),
      totalItems: products.length,
      totalUnits,
      deadStockCount,
      deadStockValue,
    },
    items,
  };
}

/**
 * Inventory Turnover KPI
 * Turnover Rate = COGS in period / Average Inventory Value (at cost)
 * Days Sales of Inventory = Period Days / Turnover Rate
 */
export async function getInventoryTurnover(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const periodDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const [cogsAggregate, products] = await Promise.all([
    // COGS = total cost of goods sold in period
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalCost: true },
    }),

    // Current inventory value (snapshot approximation)
    db.product.findMany({
      where: {
        shopId: ctx.shopId,
        isActive: true,
        stock: { gt: 0 },
      },
      select: { costPrice: true, stock: true },
    }),
  ]);

  const cogs = toNumber(cogsAggregate._sum.totalCost);
  const avgInventoryValue = products.reduce(
    (sum, p) => money.add(sum, money.multiply(toNumber(p.costPrice), p.stock)),
    0
  );

  const turnoverRate = avgInventoryValue > 0
    ? money.round(cogs / avgInventoryValue, 2)
    : 0;

  const daysSalesOfInventory = turnoverRate > 0
    ? Math.round(periodDays / turnoverRate)
    : 0;

  return {
    period: {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days: periodDays,
    },
    cogs,
    avgInventoryValue,
    turnoverRate,
    daysSalesOfInventory,
  };
}

/**
 * Sales breakdown by product category
 */
export async function getSalesByCategory(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
    },
    select: {
      quantity: true,
      subtotal: true,
      costPrice: true,
      product: { select: { category: true } },
    },
  });

  // Group by category
  const categoryMap = new Map<string, {
    revenue: number;
    cost: number;
    quantity: number;
  }>();

  let totalRevenue = 0;

  saleItems.forEach(item => {
    const cat = item.product?.category || 'ไม่มีหมวดหมู่';
    const current = categoryMap.get(cat) || { revenue: 0, cost: 0, quantity: 0 };
    const revenue = toNumber(item.subtotal);
    const cost = money.multiply(toNumber(item.costPrice), item.quantity);

    current.revenue = money.add(current.revenue, revenue);
    current.cost = money.add(current.cost, cost);
    current.quantity += item.quantity;
    totalRevenue = money.add(totalRevenue, revenue);

    categoryMap.set(cat, current);
  });

  return Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      cost: data.cost,
      profit: calcProfit(data.revenue, data.cost),
      quantity: data.quantity,
      percentage: totalRevenue > 0
        ? money.round((data.revenue / totalRevenue) * 100, 1)
        : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// =============================================================================
// PROFIT & LOSS REPORT (งบกำไรขาดทุน)
// =============================================================================

export async function getProfitLossReport(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Previous period (same duration, shifted back)
  const durationMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = new Date(start.getTime() - 1);

  const [
    salesData,
    prevSalesData,
    expensesByCategory,
    prevExpensesTotal,
    incomesData,
    prevIncomesData,
    purchasesData,
    prevPurchasesData,
  ] = await Promise.all([
    // Current period — Sales
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, totalCost: true, profit: true, discountAmount: true },
      _count: true,
    }),

    // Previous period — Sales
    db.sale.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        status: { not: 'CANCELLED' },
      },
      _sum: { netAmount: true, totalCost: true, profit: true },
      _count: true,
    }),

    // Current period — Expenses by category
    db.expense.groupBy({
      by: ['category'],
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),

    // Previous period — Expenses total
    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),

    // Current period — Incomes
    (db as any).income.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Previous period — Incomes
    (db as any).income.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),

    // Current period — Purchases (cost of goods purchased)
    db.purchase.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalCost: true },
      _count: true,
    }),

    // Previous period — Purchases
    db.purchase.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalCost: true },
    }),
  ]);

  // Calculate values
  const salesRevenue = toNumber(salesData._sum.netAmount);
  const cogs = toNumber(salesData._sum.totalCost);
  const salesDiscount = toNumber(salesData._sum.discountAmount);
  const otherIncome = toNumber(incomesData._sum?.amount);
  const totalRevenue = money.add(salesRevenue, otherIncome);
  const grossProfit = money.subtract(totalRevenue, cogs);
  const grossMargin = totalRevenue > 0 ? money.round((grossProfit / totalRevenue) * 100, 1) : 0;

  const totalExpenses = expensesByCategory.reduce(
    (sum: number, g: any) => money.add(sum, toNumber(g._sum.amount)),
    0
  );
  const netProfit = money.subtract(grossProfit, totalExpenses);
  const netMargin = totalRevenue > 0 ? money.round((netProfit / totalRevenue) * 100, 1) : 0;

  // Previous period for comparison
  const prevRevenue = money.add(
    toNumber(prevSalesData._sum.netAmount),
    toNumber(prevIncomesData._sum?.amount)
  );
  const prevExpenses = toNumber(prevExpensesTotal._sum.amount);
  const prevGrossProfit = money.subtract(
    toNumber(prevSalesData._sum.netAmount),
    toNumber(prevSalesData._sum.totalCost)
  );
  const prevNetProfit = money.subtract(prevGrossProfit, prevExpenses);

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return money.round(((current - previous) / Math.abs(previous)) * 100, 1);
  };

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    revenue: {
      sales: salesRevenue,
      otherIncome,
      discount: salesDiscount,
      total: totalRevenue,
      change: pctChange(totalRevenue, prevRevenue),
    },
    cogs,
    grossProfit,
    grossMargin,
    expenses: {
      byCategory: expensesByCategory.map((g: any) => ({
        category: g.category,
        amount: toNumber(g._sum.amount),
        count: g._count,
        percentage: totalExpenses > 0
          ? money.round((toNumber(g._sum.amount) / totalExpenses) * 100, 1)
          : 0,
      })),
      total: totalExpenses,
      change: pctChange(totalExpenses, prevExpenses),
    },
    netProfit,
    netMargin,
    netProfitChange: pctChange(netProfit, prevNetProfit),
    // Supporting stats
    salesCount: salesData._count,
    incomeCount: incomesData._count || 0,
    purchaseTotal: toNumber(purchasesData._sum.totalCost),
    purchaseCount: purchasesData._count,
    // Cash flow
    cashIn: totalRevenue,
    cashOut: money.add(toNumber(purchasesData._sum.totalCost), totalExpenses),
    netCashFlow: money.subtract(totalRevenue, money.add(toNumber(purchasesData._sum.totalCost), totalExpenses)),
  };
}

// =============================================================================
// EXPENSE BY CATEGORY REPORT (สัดส่วนหมวดหมู่รายจ่าย)
// =============================================================================

export async function getExpenseByCategoryReport(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Previous period
  const durationMs = end.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = new Date(start.getTime() - 1);

  const [currentByCategory, previousByCategory, currentTotal, previousTotal] = await Promise.all([
    db.expense.groupBy({
      by: ['category'],
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    }),

    db.expense.groupBy({
      by: ['category'],
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),

    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: start, lte: end },
        deletedAt: null,
      },
      _sum: { amount: true },
      _count: true,
    }),

    db.expense.aggregate({
      where: {
        shopId: ctx.shopId,
        date: { gte: prevStart, lte: prevEnd },
        deletedAt: null,
      },
      _sum: { amount: true },
    }),
  ]);

  const total = toNumber(currentTotal._sum.amount);
  const prevTotal = toNumber(previousTotal._sum.amount);
  const prevMap = new Map(previousByCategory.map((p: any) => [p.category, toNumber(p._sum.amount)]));

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    total,
    totalChange: prevTotal > 0 ? money.round(((total - prevTotal) / prevTotal) * 100, 1) : 0,
    count: currentTotal._count,
    categories: currentByCategory.map((g: any) => {
      const amount = toNumber(g._sum.amount);
      const prevAmount = prevMap.get(g.category) || 0;
      return {
        category: g.category,
        amount,
        count: g._count,
        percentage: total > 0 ? money.round((amount / total) * 100, 1) : 0,
        change: prevAmount > 0 ? money.round(((amount - prevAmount) / prevAmount) * 100, 1) : 0,
      };
    }),
  };
}

// =============================================================================
// SALES CHANNEL REPORT (วิเคราะห์ช่องทางขาย)
// =============================================================================

export async function getSalesChannelReport(startDate: string | undefined, endDate: string | undefined, ctx: RequestContext) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const channelData = await db.sale.groupBy({
    by: ['channel'],
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
    _sum: { netAmount: true, totalCost: true, profit: true },
    _count: true,
    orderBy: { _sum: { netAmount: 'desc' } },
  });

  const totalRevenue = channelData.reduce(
    (sum: number, g: any) => money.add(sum, toNumber(g._sum.netAmount)),
    0
  );

  const channelLabels: Record<string, string> = {
    WALK_IN: 'หน้าร้าน',
    SHOPEE: 'Shopee',
    LAZADA: 'Lazada',
    LINE: 'LINE',
    FACEBOOK: 'Facebook',
    OTHER: 'อื่นๆ',
  };

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalRevenue,
    channels: channelData.map((g: any) => {
      const revenue = toNumber(g._sum.netAmount);
      const cost = toNumber(g._sum.totalCost);
      const profit = toNumber(g._sum.profit);
      return {
        channel: g.channel,
        label: channelLabels[g.channel] || g.channel,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? money.round((profit / revenue) * 100, 1) : 0,
        count: g._count,
        percentage: totalRevenue > 0 ? money.round((revenue / totalRevenue) * 100, 1) : 0,
      };
    }),
  };
}

// =============================================================================
// CUSTOMER RANKING REPORT (จัดอันดับลูกค้า)
// =============================================================================

export async function getCustomerRankingReport(
  startDate: string | undefined,
  endDate: string | undefined,
  limit = 20,
  ctx: RequestContext
) {

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Get all sales with customer in the period
  const sales = await db.sale.findMany({
    where: {
      shopId: ctx.shopId,
      date: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
      customerId: { not: null },
    },
    select: {
      customerId: true,
      netAmount: true,
      profit: true,
      date: true,
      customer: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  // Aggregate by customer
  const customerMap = new Map<string, {
    id: string;
    name: string;
    phone: string | null;
    totalSpent: number;
    totalProfit: number;
    orderCount: number;
    lastOrderDate: Date;
  }>();

  for (const sale of sales) {
    if (!sale.customerId || !sale.customer) continue;

    const existing = customerMap.get(sale.customerId);
    const amount = toNumber(sale.netAmount);
    const profit = toNumber(sale.profit);

    if (existing) {
      existing.totalSpent = money.add(existing.totalSpent, amount);
      existing.totalProfit = money.add(existing.totalProfit, profit);
      existing.orderCount++;
      if (sale.date > existing.lastOrderDate) {
        existing.lastOrderDate = sale.date;
      }
    } else {
      customerMap.set(sale.customerId, {
        id: sale.customer.id,
        name: sale.customer.name,
        phone: sale.customer.phone,
        totalSpent: amount,
        totalProfit: profit,
        orderCount: 1,
        lastOrderDate: sale.date,
      });
    }
  }

  // Sort by totalSpent descending and limit
  const ranked = Array.from(customerMap.values())
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);

  const grandTotal = ranked.reduce((sum, c) => money.add(sum, c.totalSpent), 0);

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalCustomers: customerMap.size,
    grandTotal,
    customers: ranked.map((c, i) => ({
      rank: i + 1,
      ...c,
      avgOrderValue: c.orderCount > 0 ? money.round(c.totalSpent / c.orderCount) : 0,
      percentage: grandTotal > 0 ? money.round((c.totalSpent / grandTotal) * 100, 1) : 0,
    })),
  };
}

// =============================================================================
// DEEP ANALYTICS: VELOCITY & AGING (Phase 7)
// =============================================================================

export interface InventoryIntelligence {
  stars: any[];
  sluggish: any[];
  critical: any[];
  metadata: {
    totalValue: number;
    windowDays: number;
  };
}

export const ANALYTICS_THRESHOLDS = {
  SLUGGISH_DAYS: 30, // Default window
  HIGH_STOCK_VALUE: 10,
  STAR_PERCENTILE: 0.1, // Top 10%
};

/**
 * UC 19: Product Velocity List (Star/Sluggish/Critical)
 */
export async function getInventoryIntelligence(
  windowDays: number = 30,
  ctx: RequestContext
): Promise<InventoryIntelligence> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const [products, saleStats] = await Promise.all([
    db.product.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        costPrice: true,
        salePrice: true,
        category: true,
      },
    }),
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId: ctx.shopId,
          date: { gte: windowStart },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true, subtotal: true },
    }),
  ]);

  const statsMap = new Map(saleStats.map((s) => [s.productId, s]));
  const totalValue = products.reduce((sum, p) => sum + (p.stock * toNumber(p.costPrice)), 0);

  // Categorization
  const enriched = products.map((p) => {
    const stats = statsMap.get(p.id);
    const qtySold = stats?._sum.quantity || 0;
    const revenue = toNumber(stats?._sum.subtotal || 0);
    const avgDailySales = qtySold / windowDays;

    return {
      ...p,
      qtySold,
      revenue,
      avgDailySales,
      stockValue: p.stock * toNumber(p.costPrice),
    };
  });

  // Star: Top 10% by revenue
  const revenueSorted = [...enriched].sort((a, b) => b.revenue - a.revenue);
  const starCount = Math.max(1, Math.ceil(enriched.length * ANALYTICS_THRESHOLDS.STAR_PERCENTILE));
  const stars = revenueSorted.slice(0, starCount).filter(p => p.revenue > 0);

  // Sluggish: No sales in window AND has stock
  const sluggish = enriched.filter((p) => p.qtySold === 0 && p.stock > 0)
    .sort((a, b) => b.stockValue - a.stockValue);

  // Critical: Low stock AND recent demand
  const critical = enriched.filter((p) => p.stock <= p.minStock && p.avgDailySales > 0)
    .sort((a, b) => b.avgDailySales - a.avgDailySales);

  return {
    stars,
    sluggish,
    critical,
    metadata: {
      totalValue,
      windowDays,
    },
  };
}

/**
 * UC 20: Procurement Aging (PR -> PO -> Receive Lead Time)
 */
export async function getProcurementAging(limit: number = 20, ctx: RequestContext) {
  const purchases = await db.purchase.findMany({
    where: {
      shopId: ctx.shopId,
      docType: 'ORDER', // POs only
      status: 'RECEIVED',
      receivedAt: { not: null },
    },
    include: {
      supplier: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: limit,
  });

  // Calculate aging per purchase
  const items = await Promise.all(purchases.map(async (po) => {
    let prDate = po.createdAt; // Default to PO creation

    // Attempt to find linked PR
    if (po.linkedPRId) {
      const pr = await db.purchase.findUnique({
        where: { id: po.linkedPRId, shopId: ctx.shopId },
        select: { createdAt: true },
      });
      if (pr) prDate = pr.createdAt;
    }

    const leadTimeMs = po.receivedAt!.getTime() - prDate.getTime();
    const leadTimeDays = Math.ceil(leadTimeMs / (1000 * 60 * 60 * 24));

    return {
      id: po.id,
      purchaseNumber: po.purchaseNumber,
      supplierName: po.supplier?.name || 'Unknown',
      requestDate: prDate,
      orderDate: po.createdAt,
      receivedDate: po.receivedAt!,
      leadTimeDays,
      totalCost: toNumber(po.totalCost),
    };
  }));

  // Summary by supplier
  const supplierAgg = new Map<string, { totalDays: number; count: number }>();
  items.forEach((item) => {
    const current = supplierAgg.get(item.supplierName) || { totalDays: 0, count: 0 };
    current.totalDays += item.leadTimeDays;
    current.count++;
    supplierAgg.set(item.supplierName, current);
  });

  const supplierPerformance = Array.from(supplierAgg.entries()).map(([name, stats]) => ({
    supplierName: name,
    avgLeadTime: Math.round(stats.totalDays / stats.count),
    orderCount: stats.count,
  })).sort((a, b) => a.avgLeadTime - b.avgLeadTime);

  return {
    items,
    supplierPerformance,
  };
}

/**
 * UC 21: Sales Heatmap (Category vs Time Buckets)
 */
export async function getSalesHeatmap(windowDays: number = 30, ctx: RequestContext) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: {
        shopId: ctx.shopId,
        date: { gte: windowStart },
        status: { not: 'CANCELLED' },
      },
    },
    select: {
      saleId: true,
      quantity: true,
      subtotal: true,
      product: { select: { category: true } },
      sale: { select: { date: true } },
    },
  });

  const buckets = [
    { id: '08-11', label: '08-11', start: 8, end: 11 },
    { id: '11-14', label: '11-14', start: 11, end: 14 },
    { id: '14-17', label: '14-17', start: 14, end: 17 },
    { id: '17-20', label: '17-20', start: 17, end: 20 },
    { id: 'OTHER', label: 'Other', start: 0, end: 24 }, // ทุกช่วงเวลาที่เหลือ
  ];

  const matrix = new Map<string, Map<string, { revenue: number; bills: Set<string>; items: number }>>();
  const categories = new Set<string>();

  saleItems.forEach((item) => {
    // ใช้ชั่วโมงในเครื่อง (Client/Local context within context of the current request)
    const hour = item.sale.date.getHours();
    const category = item.product?.category || 'Uncategorized';
    categories.add(category);

    let bucketId = 'OTHER';
    for (const b of buckets) {
      if (b.id !== 'OTHER' && hour >= b.start && hour < b.end) {
        bucketId = b.id;
        break;
      }
    }

    if (!matrix.has(category)) matrix.set(category, new Map());
    const catMap = matrix.get(category)!;
    if (!catMap.has(bucketId)) {
      catMap.set(bucketId, { revenue: 0, bills: new Set(), items: 0 });
    }

    const cell = catMap.get(bucketId)!;
    cell.revenue = money.add(cell.revenue, toNumber(item.subtotal));
    cell.items += item.quantity;
    cell.bills.add(item.saleId);
  });

  // แปลงเป็นโครงสร้างที่เรียบง่ายสำหรับ UI (Flat array for mapping)
  const data = Array.from(categories).map((cat) => {
    const row: any = { category: cat };
    buckets.forEach((b) => {
      const stats = matrix.get(cat)?.get(b.id);
      row[b.id] = {
        revenue: stats?.revenue || 0,
        bills: stats?.bills.size || 0,
        items: stats?.items || 0,
      };
    });
    return row;
  });

  return {
    buckets: buckets.map(b => ({ id: b.id, label: b.label })),
    data: data.sort((a, b) => {
      const aTotal = buckets.reduce((sum, buck) => sum + a[buck.id].revenue, 0);
      const bTotal = buckets.reduce((sum, buck) => sum + b[buck.id].revenue, 0);
      return bTotal - aTotal;
    }),
  };
}
/**
 * UC 22: Reorder Suggestions & Smart Procurement
 * Predicts stock exhaustion dates and suggests restock quantities
 */
export async function getReorderSuggestions(ctx: RequestContext) {
  const windowDays = 30;
  const targetCoverageDays = 30;
  const safetyBufferDays = 3;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);

  // 1. Fetch products and 30-day velocity stats
  const [products, saleStats, aging] = await Promise.all([
    db.product.findMany({
      where: { shopId: ctx.shopId, deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        minStock: true,
        costPrice: true,
        packagingQty: true,
        moq: true,
        avgLeadTime: true,
        supplierId: true,
        category: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
    db.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          shopId: ctx.shopId,
          date: { gte: windowStart },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true },
    }),
    getProcurementAging(10, ctx),
  ]);

  const statsMap = new Map((saleStats || []).map((s) => [s.productId, s]));
  const supplierLeadTimeMap = new Map(((aging as any)?.supplierPerformance || []).map((s: any) => [s.supplierName, s.avgLeadTime]));

  // 2. Generate Suggestions
  const suggestions = products.map((p) => {
    const stats = statsMap.get(p.id);
    const qtySold = (stats as any)?._sum?.quantity || 0;
    const avgDailySales = qtySold / windowDays;

    // Effective lead time: Product Master > Supplier History > System Default (7)
    const histLeadTime = p.supplier ? supplierLeadTimeMap.get(p.supplier.name) : undefined;
    const effectiveLeadTime = Number(p.avgLeadTime || histLeadTime || 7);
    const reorderThresholdDays = effectiveLeadTime + safetyBufferDays;

    const daysRemaining = avgDailySales > 0 ? (p.stock / avgDailySales) : Infinity;

    // Suggest if stock is low vs minStock OR stock will run out within lead time
    const isUrgent = p.stock <= p.minStock || (daysRemaining !== Infinity && daysRemaining <= reorderThresholdDays);

    // Only suggest if there is demand OR stock is below minStock
    if (!isUrgent && p.stock > p.minStock) return null;

    // Calculate Suggested Qty (Target: 30 days cover)
    const needed = (avgDailySales * targetCoverageDays) - p.stock;
    const minNeeded = Math.max(needed, p.moq || 0, 1);

    // Round to nearest packaging count (Rule 14.4)
    const packSize = p.packagingQty || 1;
    const suggestedUnits = Math.ceil(minNeeded / packSize) * packSize;
    const suggestedCtn = suggestedUnits / packSize;

    let reason = "";
    if (p.stock <= 0) reason = "สต็อกหมดแล้ว";
    else if (p.stock <= p.minStock) reason = "ต่ำกว่าจุดสั่งซื้อ (Min Stock)";
    else if (daysRemaining !== Infinity && daysRemaining <= reorderThresholdDays) reason = "ใกล้รันเอาท์ (เหลือพอขาย " + Math.round(daysRemaining) + " วัน)";
    else reason = "แนะนำให้สั่งซื้อเพื่อรักษาระดับสต็อก";

    return {
      productId: p.id,
      name: p.name,
      sku: p.sku || '',
      category: p.category,
      currentStock: p.stock,
      avgDailySales,
      daysRemaining: daysRemaining === Infinity ? null : Math.round(daysRemaining),
      reorderThresholdDays,
      suggestedUnits,
      suggestedCtn,
      packSize,
      costPrice: Number(p.costPrice || 0),
      supplierId: p.supplierId,
      vendorName: p.supplier?.name || 'ไม่มีผู้จำหน่ายหลัก',
      reason,
      urgency: p.stock <= 0 ? 'CRITICAL' : (daysRemaining !== Infinity && daysRemaining <= effectiveLeadTime ? 'HIGH' : 'MEDIUM'),
    };
  }).filter(Boolean);

  return (suggestions as any[]).sort((a: any, b: any) => {
    // Sort by Urgency (CRITICAL > HIGH > MEDIUM) then by Days Remaining
    const urgencyScore: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    if (urgencyScore[a.urgency] !== urgencyScore[b.urgency]) {
      return urgencyScore[a.urgency] - urgencyScore[b.urgency];
    }
    return (a.daysRemaining || 999) - (b.daysRemaining || 999);
  });
}
