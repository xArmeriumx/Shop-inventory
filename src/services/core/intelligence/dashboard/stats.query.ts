import { db } from '@/lib/db';
import { RequestContext } from '@/types/domain';
import { money, toNumber } from '@/lib/money';
import { AuditService } from '@/services/core/system/audit.service';

export const DashboardStatsQuery = {
  async getDashboardStats(ctx: RequestContext, warehouseId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const whSaleFilter = warehouseId
      ? { items: { some: { warehouseId } } } as any
      : {};

    let todayWhSaleIds: string[] | undefined = undefined;
    let allWhSaleIds: string[] | undefined = undefined;

    if (warehouseId) {
      const [todaySaleList, allSaleList] = await Promise.all([
        db.sale.findMany({
          where: {
            shopId: ctx.shopId,
            date: { gte: today, lt: tomorrow },
            status: { not: "CANCELLED" },
            ...whSaleFilter,
          },
          select: { id: true },
        }),
        db.sale.findMany({
          where: {
            shopId: ctx.shopId,
            status: { not: "CANCELLED" },
            ...whSaleFilter,
          },
          select: { id: true },
          orderBy: { date: 'desc' },
          take: 50,
        }),
      ]);
      todayWhSaleIds = todaySaleList.map(s => s.id);
      allWhSaleIds = allSaleList.map(s => s.id);
    }

    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [
      todaySales,
      todayIncomes,
      totalProductsCount,
      lowStockCount,
      recentSales,
      lowStockProducts,
      _unusedPendingPayments,
      pendingShipments,
      todayExpenses,
      stockProducts,
    ] = await Promise.all([
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
          ...idFilter(todayWhSaleIds),
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
        where: {
          shopId: ctx.shopId,
          isActive: true,
          ...(warehouseId ? { warehouseStocks: { some: { warehouseId: warehouseId } } } : {})
        },
      }),
      db.product.count({
        where: {
          shopId: ctx.shopId,
          isActive: true,
          isLowStock: true,
          ...(warehouseId ? { warehouseStocks: { some: { warehouseId: warehouseId } } } : {})
        },
      }),
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          status: { not: "CANCELLED" },
          ...idFilter(allWhSaleIds),
        },
        select: {
          id: true, invoiceNumber: true, date: true, customerName: true,
          totalAmount: true, profit: true, customer: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 5,
      }),
      db.product.findMany({
        where: {
          shopId: ctx.shopId,
          isActive: true,
          isLowStock: true,
          ...(warehouseId ? { warehouseStocks: { some: { warehouseId: warehouseId } } } : {})
        },
        select: { id: true, name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
        take: 5,
      }),
      Promise.resolve({ _count: 0, _sum: { netAmount: null } }),
      db.shipment.count({
        where: {
          shopId: ctx.shopId,
          status: "PENDING",
          ...(warehouseId ? { warehouseId: warehouseId } : {})
        },
      }),
      db.expense.aggregate({
        where: {
          shopId: ctx.shopId, date: { gte: today, lt: tomorrow }, deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
      db.warehouseStock.findMany({
        where: {
          shopId: ctx.shopId,
          product: { isActive: true, deletedAt: null },
          ...(warehouseId ? { warehouseId: warehouseId } : {})
        },
        select: { quantity: true, product: { select: { costPrice: true } } }
      }),
    ] as any);

    const salesRevenue = toNumber(todaySales._sum?.netAmount);
    const incomeRevenue = toNumber(todayIncomes._sum?.amount);
    const totalRevenue = money.add(salesRevenue, incomeRevenue);
    const salesProfit = toNumber(todaySales._sum?.profit);

    const totalStockValue = (stockProducts as any[]).reduce(
      (sum: number, ws: any) => money.add(sum, money.multiply(toNumber(ws.product?.costPrice), ws.quantity || 0)),
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
      totalProducts: totalProductsCount,
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
        itemCount: (stockProducts as any[]).reduce((sum, ws) => sum + (toNumber(ws.quantity) || 0), 0),
      },
      governanceHealth: AuditService.getGovernanceHealth(),
    };
  }
};
