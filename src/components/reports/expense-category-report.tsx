'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { getExpenseByCategoryReport } from '@/actions/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Minus, PieChart, TrendingUp, TrendingDown, Receipt } from 'lucide-react';

type ExpenseCategoryData = Awaited<ReturnType<typeof getExpenseByCategoryReport>>;

interface ExpenseCategoryReportProps {
  startDate?: string;
  endDate?: string;
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
  'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-blue-500', 'bg-violet-500',
];

const COLORS_LIGHT = [
  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300',
  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
];

function ChangeArrow({ value }: { value: number }) {
  if (value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  // For expenses: increase = bad (red), decrease = good (green)
  return value > 0
    ? <ArrowUpRight className="h-3 w-3 text-red-500" />
    : <ArrowDownRight className="h-3 w-3 text-green-500" />;
}

export function ExpenseCategoryReport({ startDate, endDate }: ExpenseCategoryReportProps) {
  const [data, setData] = useState<ExpenseCategoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getExpenseByCategoryReport(startDate, endDate)
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const topCategory = data.categories[0];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ค่าใช้จ่ายรวม</CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatCurrency(data.total)}</div>
            <span className={`text-xs flex items-center gap-0.5 ${data.totalChange > 0 ? 'text-red-600' : data.totalChange < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              <ChangeArrow value={data.totalChange} />
              {data.totalChange !== 0 && `${data.totalChange > 0 ? '+' : ''}${data.totalChange}%`}
              {data.totalChange === 0 ? 'ไม่เปลี่ยนแปลง' : ' จากเดือนก่อน'}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">จำนวนรายการ</CardTitle>
            <PieChart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{data.count}</div>
            <p className="text-xs text-muted-foreground">{data.categories.length} หมวดหมู่</p>
          </CardContent>
        </Card>

        {topCategory && (
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">หมวดที่ใช้มากสุด</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm sm:text-lg font-bold truncate">{topCategory.category}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(topCategory.amount)} ({topCategory.percentage}%)</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Progress Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">สัดส่วนค่าใช้จ่ายตามหมวดหมู่</CardTitle>
        </CardHeader>
        <CardContent>
          {data.categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ไม่มีข้อมูลค่าใช้จ่ายในช่วงเวลานี้
            </div>
          ) : (
            <div className="space-y-3">
              {/* Stacked bar */}
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                {data.categories.map((cat, i) => (
                  <div
                    key={cat.category}
                    className={`${COLORS[i % COLORS.length]} transition-all duration-500`}
                    style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                    title={`${cat.category}: ${cat.percentage}%`}
                  />
                ))}
              </div>

              {/* Category list */}
              <div className="space-y-2 mt-4">
                {data.categories.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-3 group">
                    {/* Color dot */}
                    <div className={`w-3 h-3 rounded-full shrink-0 ${COLORS[i % COLORS.length]}`} />

                    {/* Category & percentage */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{cat.category}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${COLORS_LIGHT[i % COLORS_LIGHT.length]}`}>
                          {cat.percentage}%
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${COLORS[i % COLORS.length]}`}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Amount & change */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">{formatCurrency(cat.amount)}</div>
                      <div className="flex items-center justify-end gap-0.5">
                        <ChangeArrow value={cat.change} />
                        <span className={`text-[10px] ${cat.change > 0 ? 'text-red-500' : cat.change < 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {cat.change !== 0 ? `${cat.change > 0 ? '+' : ''}${cat.change}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-3 border-t border-muted font-bold text-sm">
                <span>รวม ({data.categories.length} หมวด, {data.count} รายการ)</span>
                <span>{formatCurrency(data.total)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
