import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { DashboardSummaryGrid } from './dashboard-summary-grid';
import { ActionableSmeDashboard } from './action-cards';
import { AdvancedOpsDashboard } from './advanced-dashboard';
import { GovernanceHealthCard } from '@/components/core/dashboard/governance-health-card';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardTemplateProps {
    stats: any;              // typed by the caller (getDashboardStats return)
    monthlyStats: any;       // typed by the caller (getMonthlyStats return)
    warehouseName?: string;
    isAdmin: boolean;
    formatCurrency: (v: string) => string;
    formatDate: (v: any) => string;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-4 w-24" /></CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-32" />
                            <Skeleton className="mt-2 h-3 w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
    );
}

// ─── DashboardTemplate ───────────────────────────────────────────────────────

/**
 * Top-level screen composer for the Dashboard.
 * Composes all sections using typed props passed down from page.tsx.
 * Does NOT fetch data — data is fetched in page.tsx and passed here.
 */
export function DashboardTemplate({ stats, monthlyStats, warehouseName, isAdmin, formatCurrency, formatDate }: DashboardTemplateProps) {
    return (
        <div className="space-y-4 sm:space-y-6">
            {/* KPI Row */}
            <DashboardSummaryGrid stats={stats} warehouseName={warehouseName} />

            {/* SME Operational Priorities */}
            <SafeBoundary variant="compact" componentName="Dashboard:ActionableSme">
                <ActionableSmeDashboard
                    metrics={stats.operational?.sme}
                    lowStockCount={stats.lowStockCount}
                />
            </SafeBoundary>

            {/* Advanced ERP Operations (Admin-only, collapsible) */}
            <SafeBoundary variant="compact" componentName="Dashboard:AdvancedOps">
                <AdvancedOpsDashboard
                    metrics={stats.operational?.advanced}
                    isAdmin={isAdmin}
                />
            </SafeBoundary>

            {/* Monthly Summary + Expenses + Governance */}
            <SafeBoundary variant="compact" componentName="Dashboard:BottomRow">
                <div className="grid gap-4 lg:grid-cols-4">
                    {/* Monthly Summary */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2 sm:pb-4">
                            <p className="text-base sm:text-lg font-semibold">สรุปรายเดือน</p>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                                {[
                                    { label: 'ยอดขาย', value: formatCurrency((monthlyStats.revenue ?? 0).toString()), className: '' },
                                    { label: 'กำไร', value: formatCurrency((monthlyStats.profit ?? 0).toString()), className: 'text-green-600' },
                                    { label: 'รายการ', value: (monthlyStats.count ?? 0).toString(), className: '' },
                                ].map((item) => (
                                    <div key={item.label} className="text-center sm:text-left">
                                        <p className="text-[10px] sm:text-sm text-muted-foreground">{item.label}</p>
                                        <p className={`text-sm sm:text-2xl font-bold truncate ${item.className}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Today Expenses */}
                    <Card>
                        <CardHeader className="pb-2 sm:pb-4">
                            <p className="text-base sm:text-lg font-semibold">ค่าใช้จ่ายวันนี้</p>
                        </CardHeader>
                        <CardContent>
                            <p className="text-lg sm:text-2xl font-bold text-red-600">
                                {formatCurrency((stats.todayExpenses?.total ?? 0).toString())}
                            </p>
                            <p className="text-xs text-muted-foreground">{stats.todayExpenses?.count ?? 0} รายการ</p>
                        </CardContent>
                    </Card>

                    {/* Governance Health */}
                    <GovernanceHealthCard data={stats.governanceHealth} />
                </div>
            </SafeBoundary>
        </div>
    );
}
