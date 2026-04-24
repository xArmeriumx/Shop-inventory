'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { getProfitLossReport } from '@/actions/accounting/reports.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus, Receipt, ShoppingCart, Coins } from 'lucide-react';

type PLData = Awaited<ReturnType<typeof getProfitLossReport>>;

interface ProfitLossReportProps {
  startDate?: string;
  endDate?: string;
}

function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> ไม่เปลี่ยนแปลง</span>;
  const isPositive = value > 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? '+' : ''}{value}{suffix} จากเดือนก่อน
    </span>
  );
}

export function ProfitLossReport({ startDate, endDate }: ProfitLossReportProps) {
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProfitLossReport(startDate, endDate)
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-80 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const isNetProfitPositive = data.netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">รายรับรวม</CardTitle>
            <Coins className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatCurrency(data.revenue.total)}</div>
            <ChangeIndicator value={data.revenue.change} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">กำไรขั้นต้น</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-emerald-600">{formatCurrency(data.grossProfit)}</div>
            <p className="text-xs text-muted-foreground">Margin {data.grossMargin}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ค่าใช้จ่าย</CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(data.expenses.total)}</div>
            <ChangeIndicator value={data.expenses.change} />
          </CardContent>
        </Card>

        <Card className={isNetProfitPositive ? 'ring-2 ring-green-200 dark:ring-green-900' : 'ring-2 ring-red-200 dark:ring-red-900'}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">★ กำไรสุทธิ</CardTitle>
            <Wallet className={`h-4 w-4 ${isNetProfitPositive ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-lg sm:text-2xl font-bold ${isNetProfitPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </div>
            <ChangeIndicator value={data.netProfitChange} />
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">งบกำไร-ขาดทุน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Revenue Section */}
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">รายรับ</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ยอดขายสุทธิ ({data.salesCount} บิล)</span>
                  <span className="font-medium">{formatCurrency(data.revenue.sales)}</span>
                </div>
                {data.revenue.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ส่วนลดรวม</span>
                    <span className="text-red-500">-{formatCurrency(data.revenue.discount)}</span>
                  </div>
                )}
                {data.revenue.otherIncome > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">รายรับอื่น ({data.incomeCount} รายการ)</span>
                    <span className="font-medium">{formatCurrency(data.revenue.otherIncome)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 dark:border-blue-800 pt-1.5 mt-1.5">
                  <span>รายรับรวม</span>
                  <span>{formatCurrency(data.revenue.total)}</span>
                </div>
              </div>
            </div>

            {/* COGS */}
            <div className="flex justify-between items-center p-3 sm:p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">ต้นทุนขาย (COGS)</span>
              </div>
              <span className="text-sm font-bold text-red-600">-{formatCurrency(data.cogs)}</span>
            </div>

            {/* Gross Profit Line */}
            <div className="flex justify-between items-center p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <div>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">กำไรขั้นต้น</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-500 ml-2">({data.grossMargin}%)</span>
              </div>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(data.grossProfit)}</span>
            </div>

            {/* Expenses Breakdown */}
            {data.expenses.byCategory.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 mb-2">ค่าใช้จ่าย</h3>
                <div className="space-y-1.5">
                  {data.expenses.byCategory.map((cat) => (
                    <div key={cat.category} className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{cat.category}</span>
                        <span className="text-[10px] text-muted-foreground/60">({cat.percentage}%)</span>
                      </div>
                      <span>-{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold border-t border-orange-200 dark:border-orange-800 pt-1.5 mt-1.5">
                    <span>ค่าใช้จ่ายรวม</span>
                    <span className="text-orange-600">-{formatCurrency(data.expenses.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Net Profit */}
            <div className={`rounded-lg p-4 sm:p-5 ${isNetProfitPositive ? 'bg-green-100 dark:bg-green-950/40' : 'bg-red-100 dark:bg-red-950/40'}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {isNetProfitPositive
                    ? <TrendingUp className="h-5 w-5 text-green-700 dark:text-green-400" />
                    : <TrendingDown className="h-5 w-5 text-red-700 dark:text-red-400" />
                  }
                  <span className={`text-base sm:text-lg font-bold ${isNetProfitPositive ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
                    ★ กำไรสุทธิ
                  </span>
                  <span className={`text-sm ${isNetProfitPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                    ({data.netMargin}%)
                  </span>
                </div>
                <span className={`text-lg sm:text-2xl font-bold ${isNetProfitPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {formatCurrency(data.netProfit)}
                </span>
              </div>
              <div className="mt-1">
                <ChangeIndicator value={data.netProfitChange} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            กระแสเงินสด
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">เงินเข้า</p>
              <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(data.cashIn)}</p>
              <p className="text-[10px] text-muted-foreground">ขาย + รายรับอื่น</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">เงินออก</p>
              <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(data.cashOut)}</p>
              <p className="text-[10px] text-muted-foreground">ซื้อสินค้า + ค่าใช้จ่าย</p>
            </div>
            <div className={`text-center p-3 rounded-lg ${data.netCashFlow >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-orange-50 dark:bg-orange-950/30'}`}>
              <p className="text-xs text-muted-foreground mb-1">เงินสดสุทธิ</p>
              <p className={`text-sm sm:text-lg font-bold ${data.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {data.netCashFlow >= 0 ? '+' : ''}{formatCurrency(data.netCashFlow)}
              </p>
              <p className="text-[10px] text-muted-foreground">เงินเข้า − เงินออก</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
