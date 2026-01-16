import { Suspense } from 'react';
import { Package, TrendingUp, ShoppingCart, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardStats, getMonthlyStats } from '@/actions/dashboard';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

async function DashboardContent() {
  const [stats, monthlyStats] = await Promise.all([
    getDashboardStats(),
    getMonthlyStats(),
  ]);

  const statsCards = [
    {
      title: 'ยอดขายวันนี้',
      value: formatCurrency(stats.todaySales.revenue.toString()),
      subtitle: `${stats.todaySales.count} รายการ`,
      icon: ShoppingCart,
      iconColor: 'text-blue-600',
    },
    {
      title: 'กำไรวันนี้',
      value: formatCurrency(stats.todaySales.profit.toString()),
      subtitle: `จากยอดขาย ${stats.todaySales.count} รายการ`,
      icon: TrendingUp,
      iconColor: 'text-green-600',
    },
    {
      title: 'สินค้าทั้งหมด',
      value: stats.totalProducts.toString(),
      subtitle: 'รายการสินค้า',
      icon: Package,
      iconColor: 'text-purple-600',
    },
    {
      title: 'สินค้าใกล้หมด',
      value: stats.lowStockCount.toString(),
      subtitle: 'รายการที่ต้องเติม',
      icon: AlertCircle,
      iconColor: 'text-red-600',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Cards - 2 columns on mobile */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statsCards.map((stat, index) => (
          <Card key={index}>
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
        ))}
      </div>

      {/* Monthly Summary */}
      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <CardTitle className="text-base sm:text-lg">สรุปเดือนนี้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground">ยอดขายรวม</p>
              <p className="text-sm sm:text-2xl font-bold truncate">
                {formatCurrency(monthlyStats.revenue.toString())}
              </p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground">กำไรรวม</p>
              <p className="text-sm sm:text-2xl font-bold text-green-600 truncate">
                {formatCurrency(monthlyStats.profit.toString())}
              </p>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[10px] sm:text-sm text-muted-foreground">จำนวนรายการ</p>
              <p className="text-sm sm:text-2xl font-bold">{monthlyStats.count} บิล</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>รายการขายล่าสุด</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sales">ดูทั้งหมด</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentSales.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มีรายการขาย
                <br />
                <Button asChild className="mt-4" size="sm">
                  <Link href="/sales/new">บันทึกการขายแรก</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recentSales.map((sale: any) => (
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
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                สินค้าใกล้หมด
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/products">จัดการสินค้า</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                สินค้าทุกรายการมีสต็อกเพียงพอ
              </div>
            ) : (
              <div className="space-y-3">
                {stats.lowStockProducts.map((product: any) => (
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
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">
                        เหลือ {product.stock}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ขั้นต่ำ: {product.minStock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
