import { Suspense } from 'react';
import { Package, TrendingUp, ShoppingCart, AlertCircle, Truck, Wallet, Warehouse } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardStats, getMonthlyStats } from '@/actions/dashboard';
import { refreshOperationalAlerts } from '@/actions/notifications';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { GovernanceHealthCard } from '@/components/dashboard/governance-health-card';
import { ActionableSmeDashboard } from '@/components/features/dashboard/action-cards';
import { AdvancedOpsDashboard } from '@/components/features/dashboard/advanced-dashboard';
import { requireAuth } from '@/lib/auth-guard';


async function DashboardContent() {
  const [stats, monthlyStats, ctx] = await Promise.all([
    getDashboardStats(),
    getMonthlyStats(),
    requireAuth(),
  ]);

  await refreshOperationalAlerts(); // Proactive Health Check (Phase 5 Heartbeat)

  const statsCards = [
    {
      title: 'วันนี้ยอดขาย',
      value: formatCurrency(stats.todaySales.revenue.toString()),
      subtitle: `${stats.todaySales.count} รายการ`,
      icon: ShoppingCart,
      iconColor: 'text-blue-600',
    },
    {
      title: 'วันนี้กำไร',
      value: formatCurrency(stats.todaySales.profit.toString()),
      subtitle: `จาก ${stats.todaySales.count} รายการ`,
      icon: TrendingUp,
      iconColor: 'text-green-600',
    },
    {
      title: 'สินค้าทั้งหมด',
      value: stats.totalProducts.toString(),
      subtitle: 'รายการที่เปืดขาย',
      icon: Package,
      iconColor: 'text-purple-600',
    },
    {
      title: 'มูลค่าสต็อกรวม',
      value: formatCurrency(stats.stockValue.total.toString()),
      subtitle: `${stats.stockValue.itemCount} ชิ้นในคลัง`,
      icon: Warehouse,
      iconColor: 'text-indigo-600',
      href: '/reports?tab=stock-value',
    },
  ];

  // We consider a user "Admin" if they can view reports or delete products
  const isAdmin = ctx.permissions.includes('REPORT_VIEW_SALES' as any);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards - 2 columns on mobile, 3 on md, 6 on lg */}
      <SafeBoundary variant="compact" componentName="Dashboard:StatsCards">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {statsCards.map((stat, index) => {
            const content = (
              <Card key={index} className={(stat as any).href ? 'hover:bg-muted/50 transition-colors cursor-pointer' : ''}>
                <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor} shrink-0`} />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-lg sm:text-2xl font-bold truncate">{stat.value}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.subtitle}</p>
                </CardContent>
              </Card>
            );
            if ((stat as any).href) {
              return <Link key={index} href={(stat as any).href}>{content}</Link>;
            }
            return content;
          })}
        </div>
      </SafeBoundary>

      {/* SME Operational Priorities (Rule: Easy Language) */}
      <SafeBoundary variant="compact" componentName="Dashboard:ActionableSme">
        <ActionableSmeDashboard 
          metrics={(stats as any).operational.sme} 
          lowStockCount={stats.lowStockCount}
        />
      </SafeBoundary>

      {/* Advanced ERP Operations (Collapsible) */}
      <SafeBoundary variant="compact" componentName="Dashboard:AdvancedOps">
        <AdvancedOpsDashboard 
          metrics={(stats as any).operational.advanced}
          isAdmin={isAdmin}
        />
      </SafeBoundary>

      {/* Monthly Summary + Today Expenses + Governance */}
      <SafeBoundary variant="compact" componentName="Dashboard:OperationsOverview">
        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg">สรุปรายเดือน</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">ยอดขาย</p>
                  <p className="text-sm sm:text-2xl font-bold truncate">
                    {formatCurrency(monthlyStats.revenue.toString())}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">กำไร</p>
                  <p className="text-sm sm:text-2xl font-bold text-green-600 truncate">
                    {formatCurrency(monthlyStats.profit.toString())}
                  </p>
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-[10px] sm:text-sm text-muted-foreground">รายการขาย</p>
                  <p className="text-sm sm:text-2xl font-bold">{monthlyStats.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base sm:text-lg">ค่าใช้จ่ายวันนี้</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg sm:text-2xl font-bold text-red-600">
                {formatCurrency(stats.todayExpenses.total.toString())}
              </p>
              <p className="text-xs text-muted-foreground">{stats.todayExpenses.count} รายการ</p>
            </CardContent>
          </Card>
          
          <GovernanceHealthCard data={(stats as any).governanceHealth} />
        </div>
      </SafeBoundary>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <SafeBoundary variant="compact" componentName="RecentSales">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Sales</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sales">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const recentSales = Array.isArray(stats.recentSales) ? stats.recentSales : [];
                if (recentSales.length === 0) {
                  return (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No sales yet
                      <br />
                      <Button asChild className="mt-4" size="sm">
                        <Link href="/sales/new">Create First Sale</Link>
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {recentSales.map((sale: any) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between border-b pb-3 last:border-0"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{sale.invoiceNumber}</p>
                            <Badge variant="secondary" className="text-xs">
                              {sale.customerName}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(sale.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(sale.totalAmount.toString())}
                          </p>
                          <p className="text-xs text-green-600">
                            +{formatCurrency(sale.profit.toString())}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </SafeBoundary>

        {/* Low Stock Alert */}
        <SafeBoundary variant="compact" componentName="LowStockAlert">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Low Stock Alert
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/products/low-stock">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const lowStockProducts = Array.isArray(stats.lowStockProducts) ? stats.lowStockProducts : [];
                if (lowStockProducts.length === 0) {
                  return (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      All products are well-stocked
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {lowStockProducts.map((product: any) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3"
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">
                              SKU: {product.sku}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                          <div>
                            <p className="text-sm font-bold text-red-600">
                              {product.stock} left
                            </p>
                            <p className="text-xs text-muted-foreground">
                              min: {product.minStock}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100">
                            <Link href={`/purchases/new?productId=${product.id}&quantity=${Math.max(product.minStock * 2 - product.stock, 1)}`}>
                              <ShoppingCart className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </SafeBoundary>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

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
