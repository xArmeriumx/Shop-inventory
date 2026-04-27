import { db } from '@/lib/db';
import { RequestContext, ServiceError } from '@/types/domain';
import { money, toNumber } from '@/lib/money';
import { AuditService } from '@/services/core/system/audit.service';

export const DashboardService = {
  async getDashboardStats(ctx: RequestContext, warehouseId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Resolve Sale IDs for warehouse filtering (Prisma aggregate doesn't support relation filters)
    // Best Practice: Use top-down Sale -> items.some filter including null for legacy data safety
    const whSaleFilter = warehouseId
      ? { items: { some: { OR: [{ warehouseId }, { warehouseId: null }] } } }
      : {};

    // For aggregate: resolve Sale IDs by date scopes
    let todayWhSaleIds: string[] | undefined = undefined;
    let allWhSaleIds: string[] | undefined = undefined;

    if (warehouseId) {
      const [todaySaleList, allSaleList] = await Promise.all([
        // Today's sales that have at least one item from this warehouse
        db.sale.findMany({
          where: {
            shopId: ctx.shopId,
            date: { gte: today, lt: tomorrow },
            status: { not: "CANCELLED" },
            ...whSaleFilter,
          },
          select: { id: true },
        }),
        // All-time recent sales from this warehouse
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

    // ── Helper: Safe ID filter (handles empty arrays correctly) ──────────
    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [
      todaySales,
      todayIncomes,
      totalProducts,
      lowStockCount,
      recentSales,
      lowStockProducts,
      _unusedPendingPayments,
      pendingShipments,
      todayExpenses,
      stockProducts,
    ] = await Promise.all([
      // 1. Today's revenue aggregate (uses pre-resolved IDs)
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
      // 2. Today's income (not warehouse-scoped — income isn't tied to warehouses)
      (db as any).income.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: today, lt: tomorrow },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
      // 3. Total active products (warehouse-scoped via WarehouseStock relation)
      db.product.count({
        where: {
          shopId: ctx.shopId,
          isActive: true,
          ...(warehouseId && { warehouseStocks: { some: { warehouseId } } })
        },
      }),
      // 4. Low stock products
      db.product.count({
        where: {
          shopId: ctx.shopId,
          isActive: true,
          isLowStock: true,
          ...(warehouseId && { warehouseStocks: { some: { warehouseId } } })
        },
      }),
      // 5. Recent sales (uses pre-resolved IDs for all-time scope)
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
      // 6. Low stock product details
      db.product.findMany({
        where: {
          shopId: ctx.shopId,
          isActive: true,
          isLowStock: true,
          ...(warehouseId && { warehouseStocks: { some: { warehouseId } } })
        },
        select: { id: true, name: true, sku: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
        take: 5,
      }),
      // 7. (Unused placeholder)
      Promise.resolve({ _count: 0, _sum: { netAmount: null } }),
      // 8. Pending shipments
      db.shipment.count({
        where: {
          shopId: ctx.shopId,
          status: "PENDING",
          ...(warehouseId && { warehouseId })
        },
      }),
      // 9. Today's expenses (not warehouse-scoped)
      db.expense.aggregate({
        where: {
          shopId: ctx.shopId, date: { gte: today, lt: tomorrow }, deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
      // 10. Stock value calculation
      warehouseId ?
        db.warehouseStock.findMany({
          where: { warehouseId },
          select: { quantity: true, product: { select: { costPrice: true } } }
        }) :
        db.product.findMany({
          where: { shopId: ctx.shopId, isActive: true, stock: { gt: 0 } },
          select: { costPrice: true, stock: true },
        }),
    ] as any);

    const salesRevenue = toNumber(todaySales._sum?.netAmount);
    const incomeRevenue = toNumber(todayIncomes._sum?.amount);
    const totalRevenue = money.add(salesRevenue, incomeRevenue);
    const salesProfit = toNumber(todaySales._sum?.profit);

    const totalStockValue = warehouseId ?
      (stockProducts as any[]).reduce(
        (sum: number, ws: any) => money.add(sum, money.multiply(toNumber(ws.product?.costPrice), ws.quantity || 0)),
        0
      ) :
      (stockProducts as any[]).reduce(
        (sum: number, p: any) => money.add(sum, money.multiply(toNumber(p.costPrice), p.stock || 0)),
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
      totalProducts,
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
        itemCount: stockProducts.length,
      },
      governanceHealth: AuditService.getGovernanceHealth(),
    };
  },

  /**
   * getOperationalMetrics - Aggregate actionable tasks for the Two-Tier Dashboard (Rule: SME-First)
   */
  async getOperationalMetrics(ctx: RequestContext) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 3); // For Stuck Documents detection

    const [
      pendingSalesCount,
      pendingProcurementCount,
      pendingShipmentsCount,
      recentStockMoves,
      prToOrderCount,
      incompleteShipmentsCount,
      stuckSalesCount,
      stuckPurchasesCount,
      governanceIncidentsToday
    ] = await Promise.all([
      // SME 1: งานขายค้าง (DRAFT or CONFIRMED)
      db.sale.count({
        where: { shopId: ctx.shopId, status: { in: ['DRAFT', 'CONFIRMED'] } }
      }),
      // SME 2: งานซื้อค้าง (Active PR/PO that is not RECEIVED)
      db.purchase.count({
        where: { shopId: ctx.shopId, status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] } }
      }),
      // SME 3: งานส่งของค้าง (PENDING or PROCESSING)
      db.shipment.count({
        where: { shopId: ctx.shopId, status: { in: ['PENDING', 'PROCESSING'] } }
      }),
      // SME 4: ปรับสต็อกมือล่าสุด (Audit)
      db.auditLog.findMany({
        where: { shopId: ctx.shopId, action: 'STOCK_MOVE' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, actorName: true, note: true, targetId: true }
      }),
      // ADV 1: PR รอออก PO
      db.purchase.count({
        where: { shopId: ctx.shopId, docType: 'REQUEST', status: 'APPROVED' }
      }),
      // ADV 2: Shipment พิกัดไม่ครบ
      db.shipment.count({
        where: {
          shopId: ctx.shopId,
          status: { notIn: ['CANCELLED', 'DELIVERED'] },
          OR: [{ latitude: null }, { longitude: null }]
        }
      }),
      // ADV 3: Stuck Sales (> 3 days)
      db.sale.count({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
          createdAt: { lt: limitDate }
        }
      }),
      // ADV 4: Stuck Purchases (> 3 days)
      db.purchase.count({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] },
          createdAt: { lt: limitDate }
        }
      }),
      // ADV 5: Governance Incidents Today
      db.auditLog.count({
        where: {
          shopId: ctx.shopId,
          status: 'DENIED',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }),
    ]);

    return {
      sme: {
        pendingSales: pendingSalesCount,
        pendingProcurement: pendingProcurementCount,
        pendingShipments: pendingShipmentsCount,
        recentStockMoves: recentStockMoves.map(log => ({
          id: log.id,
          date: log.createdAt,
          actor: log.actorName || 'ระบบ',
          note: log.note || 'ปรับปรุงสต็อก',
          productId: log.targetId
        })),
      },
      advanced: {
        prToOrder: prToOrderCount,
        incompleteShipments: incompleteShipmentsCount,
        stuckDocs: stuckSalesCount + stuckPurchasesCount,
        governanceIncidents: governanceIncidentsToday,
      }
    };
  },

  async getMonthlyStats(ctx: RequestContext, warehouseId?: string) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Top-down ID resolution: Sale → items.some (Prisma best practice)
    let monthSaleIds: string[] | undefined = undefined;
    if (warehouseId) {
      const matchingSales = await db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: { not: "CANCELLED" },
          items: { some: { OR: [{ warehouseId }, { warehouseId: null }] } },
        },
        select: { id: true },
      });
      monthSaleIds = matchingSales.map(s => s.id);
    }

    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [monthlySales, monthlyIncomes] = await Promise.all([
      db.sale.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          status: { not: "CANCELLED" },
          ...idFilter(monthSaleIds),
        },
        _sum: { netAmount: true, profit: true },
        _count: true,
      }),
      (db as any).income.aggregate({
        where: {
          shopId: ctx.shopId,
          date: { gte: firstDayOfMonth, lt: firstDayOfNextMonth },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const salesRevenue = toNumber(monthlySales._sum?.netAmount);
    const incomeRevenue = toNumber(monthlyIncomes._sum?.amount);
    const totalRevenue = money.add(salesRevenue, incomeRevenue);

    return {
      revenue: totalRevenue,
      salesRevenue,
      incomeRevenue,
      profit: toNumber(monthlySales._sum?.profit),
      count: monthlySales._count,
      incomeCount: monthlyIncomes._count,
    };
  },

  async getSalesChartData(days = 7, ctx: RequestContext, warehouseId?: string) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Top-down ID resolution for chart data
    let chartSaleIds: string[] | undefined = undefined;
    if (warehouseId) {
      const matchingSales = await db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          items: { some: { OR: [{ warehouseId }, { warehouseId: null }] } },
        },
        select: { id: true },
      });
      chartSaleIds = matchingSales.map(s => s.id);
    }

    const idFilter = (ids: string[] | undefined) =>
      ids !== undefined
        ? { id: ids.length > 0 ? { in: ids } : { equals: 'NON_EXISTENT_ID' } }
        : {};

    const [sales, incomes] = await Promise.all([
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          status: { not: "CANCELLED" },
          ...idFilter(chartSaleIds),
        },
        select: { date: true, netAmount: true },
        orderBy: { date: "asc" },
      }),
      (db as any).income.findMany({
        where: {
          shopId: ctx.shopId,
          date: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        select: { date: true, amount: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const revenueByDate: Record<string, { sales: number; income: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      revenueByDate[dateStr] = { sales: 0, income: 0 };
    }

    sales.forEach((sale: any) => {
      const dateStr = sale.date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      if (revenueByDate[dateStr] !== undefined) {
        revenueByDate[dateStr].sales = money.add(revenueByDate[dateStr].sales, toNumber(sale.netAmount));
      }
    });

    incomes.forEach((inc: any) => {
      const dateStr = inc.date.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
      if (revenueByDate[dateStr] !== undefined) {
        revenueByDate[dateStr].income = money.add(revenueByDate[dateStr].income, toNumber(inc.amount));
      }
    });

    return Object.entries(revenueByDate).map(([date, data]) => ({
      date,
      revenue: money.add(data.sales, data.income),
      salesRevenue: data.sales,
      incomeRevenue: data.income,
    }));
  },

  /**
   * ดึงรายการเอกสารที่ค้าง (Stale Documents) ทั้งหมดที่เกิน 3 วัน
   */
  async getStaleDocuments(ctx: RequestContext) {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 3);

    const [staleSales, stalePurchases] = await Promise.all([
      db.sale.findMany({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'CONFIRMED'] },
          createdAt: { lt: limitDate }
        },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50
      }),
      db.purchase.findMany({
        where: {
          shopId: ctx.shopId,
          status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'] },
          createdAt: { lt: limitDate }
        },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
        take: 50
      })
    ]);

    return {
      sales: staleSales.map(s => ({
        id: s.id,
        number: s.invoiceNumber,
        date: s.date,
        createdAt: s.createdAt,
        status: s.status,
        partner: s.customer?.name || s.customerName || 'ลูกค้าทั่วไป',
        amount: Number(s.netAmount),
        type: 'SALE'
      })),
      purchases: stalePurchases.map(p => ({
        id: p.id,
        number: p.purchaseNumber,
        date: p.date,
        createdAt: p.createdAt,
        status: p.status,
        partner: p.supplier?.name || 'ไม่ระบุผู้ขาย',
        amount: Number(p.totalCost),
        type: p.docType === 'REQUEST' ? 'PR' : 'PO'
      }))
    };
  }
};
