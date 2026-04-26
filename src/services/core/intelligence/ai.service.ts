import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { AuditService } from '../system/audit.service';

export interface AiShopContextData {
  shopName: string;
  todaySales: { count: number; amount: number; profit: number };
  monthSales: { count: number; amount: number; profit: number };
  productCount: number;
  lowStockItems: { name: string; stock: number; minStock: number }[];
  topProducts: { name: string; quantity: number; subtotal: number }[];
  monthExpenses: { count: number; amount: number };
  monthIncomes: { count: number; amount: number };
  recentSales: { amount: number; items: number; paymentMethod: string; time: string }[];
  totalReserved: number;
  governanceHealth: { deniedToday: number; status: string };
}

export const AiService = {
  /**
   * Orchestrates the collection of shop data for AI context.
   */
  async getShopContext(ctx: RequestContext): Promise<AiShopContextData> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      shop,
      stats,
      products,
      finance,
      recent,
      auditMetrics
    ] = await Promise.all([
      db.shop.findUnique({ where: { id: ctx.shopId }, select: { name: true } }),
      this.getSalesStats(ctx.shopId, startOfToday, startOfMonth),
      this.getProductStats(ctx.shopId, startOfMonth),
      this.getFinancialStats(ctx.shopId, startOfMonth),
      this.getRecentSales(ctx.shopId),
      AuditService.getSecurityDashboardMetrics(ctx.shopId),
    ]);

    const totalReservedAgg = await db.product.aggregate({
      where: { shopId: ctx.shopId, deletedAt: null },
      _sum: { reservedStock: true },
    });

    return {
      shopName: shop?.name || 'ไม่ระบุ',
      ...stats,
      ...products,
      ...finance,
      recentSales: recent,
      totalReserved: Number(totalReservedAgg._sum.reservedStock || 0),
      governanceHealth: {
        deniedToday: auditMetrics.metrics.deniedToday,
        status: auditMetrics.governanceHealth.status,
      },
    };
  },

  async getSalesStats(shopId: string, today: Date, month: Date) {
    const [todayAgg, monthAgg] = await Promise.all([
      db.sale.aggregate({
        where: { shopId, createdAt: { gte: today } },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { shopId, createdAt: { gte: month } },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
    ]);

    return {
      todaySales: {
        count: todayAgg._count,
        amount: Number(todayAgg._sum.netAmount || 0),
        profit: Number(todayAgg._sum.profit || 0),
      },
      monthSales: {
        count: monthAgg._count,
        amount: Number(monthAgg._sum.netAmount || 0),
        profit: Number(monthAgg._sum.profit || 0),
      },
    };
  },

  async getProductStats(shopId: string, monthStart: Date) {
    const [count, lowStock, top] = await Promise.all([
      db.product.count({ where: { shopId, deletedAt: null, isActive: true } }),
      db.product.findMany({
        where: { shopId, isLowStock: true, deletedAt: null },
        select: { name: true, stock: true, minStock: true },
        take: 5,
      }),
      db.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { shopId, createdAt: { gte: monthStart } } },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    // Enhance top products with names
    const topProductDetails = await db.product.findMany({
      where: { id: { in: top.map(p => p.productId) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(topProductDetails.map(p => [p.id, p.name]));

    return {
      productCount: count,
      lowStockItems: lowStock,
      topProducts: top.map(p => ({
        name: nameMap.get(p.productId) || 'ไม่ทราบ',
        quantity: p._sum.quantity || 0,
        subtotal: Number(p._sum.subtotal || 0),
      })),
    };
  },

  async getFinancialStats(shopId: string, monthStart: Date) {
    const [expenses, incomes] = await Promise.all([
      db.expense.aggregate({
        where: { shopId, date: { gte: monthStart }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
      (db as any).income.aggregate({
        where: { shopId, date: { gte: monthStart }, deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      monthExpenses: {
        count: expenses._count,
        amount: Number(expenses._sum.amount || 0),
      },
      monthIncomes: {
        count: incomes._count,
        amount: Number(incomes._sum.amount || 0),
      },
    };
  },

  async getRecentSales(shopId: string) {
    const sales = await db.sale.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    });

    return sales.map(s => ({
      amount: Number(s.totalAmount),
      items: s._count.items,
      paymentMethod: s.paymentMethod,
      time: new Date(s.createdAt).toLocaleTimeString('th-TH'),
    }));
  }
};
