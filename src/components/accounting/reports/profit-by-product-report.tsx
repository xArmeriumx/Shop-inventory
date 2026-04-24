'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getProfitByProduct } from '@/actions/accounting/reports.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

type ProfitData = Awaited<ReturnType<typeof getProfitByProduct>>;

interface ProfitByProductReportProps {
  startDate?: string;
  endDate?: string;
}

export function ProfitByProductReport({ startDate, endDate }: ProfitByProductReportProps) {
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'totalRevenue' | 'name'>('profit');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    getProfitByProduct(startDate, endDate)
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'name') return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortBy] as number) - (b[sortBy] as number));
  });

  // Summary
  const totalRevenue = data.reduce((s, d) => s + d.totalRevenue, 0);
  const totalCost = data.reduce((s, d) => s + d.totalCost, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const dangerCount = data.filter(d => d.margin < 10).length;
  const warningCount = data.filter(d => d.margin >= 10 && d.margin < 20).length;

  const getMarginBg = (margin: number) => {
    if (margin < 10) return 'bg-red-50 dark:bg-red-950/30';
    if (margin < 20) return 'bg-yellow-50 dark:bg-yellow-950/30';
    return '';
  };

  const getMarginBadge = (margin: number) => {
    if (margin < 10) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    if (margin < 20) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    if (margin >= 30) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    return 'bg-muted text-muted-foreground';
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => (
    <span className="ml-1 text-xs">{sortBy === field ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">กำไรรวม</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-lg sm:text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalProfit)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">จาก {data.length} สินค้า</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{avgMargin}%</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Revenue: {formatCurrency(totalRevenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">⚠️ Margin ต่ำ</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">{warningCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">margin 10-20%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">🔴 Margin อันตราย</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-red-600">{dangerCount}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">margin &lt; 10%</p>
          </CardContent>
        </Card>
      </div>

      {/* Profit Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">กำไรรายสินค้า</CardTitle>
            <div className="flex gap-1 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">&lt;10%</span>
              <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">10-20%</span>
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">&gt;30%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b-2 border-muted">
                  <th className="text-left py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('name')}>
                    สินค้า <SortIcon field="name" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold">จำนวน</th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('totalRevenue')}>
                    Revenue <SortIcon field="totalRevenue" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold">Cost</th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('profit')}>
                    Profit <SortIcon field="profit" />
                  </th>
                  <th className="text-right py-2 px-2 font-semibold cursor-pointer hover:text-primary" onClick={() => handleSort('margin')}>
                    Margin <SortIcon field="margin" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {sorted.map(item => (
                  <tr key={item.productId} className={getMarginBg(item.margin)}>
                    <td className="py-2 px-2">
                      <div className="font-medium">{item.name}</div>
                      {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                    </td>
                    <td className="text-right py-2 px-2">{formatNumber(item.totalQty)}</td>
                    <td className="text-right py-2 px-2">{formatCurrency(item.totalRevenue)}</td>
                    <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(item.totalCost)}</td>
                    <td className={`text-right py-2 px-2 font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.profit)}
                    </td>
                    <td className="text-right py-2 px-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMarginBadge(item.margin)}`}>
                        {item.margin}%
                      </span>
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      ไม่มีข้อมูลในช่วงเวลานี้
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-muted/50">
                  <td className="py-3 px-2">รวม ({sorted.length} รายการ)</td>
                  <td className="text-right py-3 px-2">{formatNumber(data.reduce((s, d) => s + d.totalQty, 0))}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(totalRevenue)}</td>
                  <td className="text-right py-3 px-2">{formatCurrency(totalCost)}</td>
                  <td className={`text-right py-3 px-2 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalProfit)}
                  </td>
                  <td className="text-right py-3 px-2">{avgMargin}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
