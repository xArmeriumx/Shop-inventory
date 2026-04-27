import { Suspense } from 'react';
import { getDashboardStats, getMonthlyStats } from '@/actions/core/dashboard.actions';
import { refreshOperationalAlerts } from '@/actions/core/notifications.actions';
import { requireAuth } from '@/lib/auth-guard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DashboardTemplate, DashboardSkeleton } from '@/components/core/dashboard/dashboard-template';
import { SetupProgressCard } from '@/components/onboarding/setup-progress-card';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { WarehouseFilter } from '@/components/shared/warehouse-filter';

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function DashboardContent({ warehouseId, warehouseName }: { warehouseId?: string; warehouseName?: string }) {
  const [statsRes, monthlyStatsRes, ctx] = await Promise.all([
    getDashboardStats(warehouseId),
    getMonthlyStats(warehouseId),
    requireAuth(),
  ]);

  await refreshOperationalAlerts();

  // Guard & Extract standard pattern
  if (!statsRes.success || !monthlyStatsRes.success) {
    // In a dashboard, we might want to show partial data or a specific error
    // For now, we'll extract data or fallback to prevent crashing the whole page
  }

  const stats = statsRes.success ? statsRes.data : {
    todaySales: { revenue: 0, profit: 0, count: 0 },
    totalProducts: 0,
    lowStockCount: 0,
    recentSales: [],
    lowStockProducts: [],
    pendingPayments: { count: 0, amount: 0 },
    pendingShipments: 0,
    todayExpenses: { total: 0, count: 0 },
    stockValue: { total: 0, itemCount: 0 },
    governanceHealth: { score: 100, status: 'HEALTHY', incidents: [] },
    operational: {
      sme: { pendingSales: 0, pendingProcurement: 0, pendingShipments: 0, recentStockMoves: [] },
      advanced: { prToOrder: 0, incompleteShipments: 0, stuckDocs: 0, governanceIncidents: 0 }
    }
  };

  const monthlyStats = monthlyStatsRes.success ? monthlyStatsRes.data : {
    revenue: 0,
    profit: 0,
    count: 0
  };

  const isAdmin = ctx.permissions.includes('REPORT_VIEW_SALES' as any);

  return (
    <>
      {isAdmin && (
        <div className="mb-6">
          <SetupProgressCard />
        </div>
      )}
      <DashboardTemplate
        stats={stats}
        monthlyStats={monthlyStats}
        warehouseName={warehouseName}
        isAdmin={isAdmin}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: { searchParams: { warehouseId?: string } }) {
  const warehouseId = searchParams.warehouseId;
  const warehousesRes = await getWarehousesAction();
  const warehouses = warehousesRes.data || [];
  const activeWarehouse = warehouses.find((w: any) => w.id === warehouseId);

  return (
    <div>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            {activeWarehouse && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium animate-in fade-in zoom-in duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {activeWarehouse.name}
              </div>
            )}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">ภาพรวมการดำเนินงาน</p>
        </div>

        {warehouses.length > 0 && (
          <WarehouseFilter warehouses={warehouses} activeWarehouseId={warehouseId} />
        )}
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          warehouseId={warehouseId}
          warehouseName={activeWarehouse?.name}
        />
      </Suspense>
    </div>
  );
}
