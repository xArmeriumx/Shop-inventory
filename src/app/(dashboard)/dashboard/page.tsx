import { Suspense } from 'react';
import { getDashboardStats, getMonthlyStats } from '@/actions/core/dashboard.actions';
import { refreshOperationalAlerts } from '@/actions/core/notifications.actions';
import { requireAuth } from '@/lib/auth-guard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DashboardTemplate, DashboardSkeleton } from '@/components/core/dashboard/dashboard-template';

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function DashboardContent() {
  const [stats, monthlyStats, ctx] = await Promise.all([
    getDashboardStats(),
    getMonthlyStats(),
    requireAuth(),
  ]);

  await refreshOperationalAlerts();

  const isAdmin = ctx.permissions.includes('REPORT_VIEW_SALES' as any);

  return (
    <DashboardTemplate
      stats={stats}
      monthlyStats={monthlyStats}
      isAdmin={isAdmin}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">ภาพรวมการดำเนินงาน</p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
