'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getComparisonReport } from '@/actions/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, ArrowDownRight, Minus, Calendar } from 'lucide-react';

type ComparisonData = Awaited<ReturnType<typeof getComparisonReport>>;

export function PeriodComparisonReport() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  // Default: this month vs last month
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const [p1Start, setP1Start] = useState(thisMonthStart);
  const [p1End, setP1End] = useState(thisMonthEnd);
  const [p2Start, setP2Start] = useState(lastMonthStart);
  const [p2End, setP2End] = useState(lastMonthEnd);

  const fetchData = () => {
    setLoading(true);
    getComparisonReport(p1Start, p1End, p2Start, p2End)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  };

  const getChangeColor = (value: number, inverted = false) => {
    if (value === 0) return 'text-muted-foreground';
    const isPositive = inverted ? value < 0 : value > 0;
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  const getChangeBadge = (value: number, inverted = false) => {
    if (value === 0) return 'bg-muted text-muted-foreground';
    const isPositive = inverted ? value < 0 : value > 0;
    return isPositive 
      ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
      : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  };

  return (
    <div className="space-y-4">
      {/* Date Pickers */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ช่วงเวลา 1 (ปัจจุบัน)</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)} className="w-auto h-8 text-sm" />
                <span className="text-muted-foreground">—</span>
                <Input type="date" value={p1End} onChange={e => setP1End(e.target.value)} className="w-auto h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">ช่วงเวลา 2 (เปรียบเทียบ)</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)} className="w-auto h-8 text-sm" />
                <span className="text-muted-foreground">—</span>
                <Input type="date" value={p2End} onChange={e => setP2End(e.target.value)} className="w-auto h-8 text-sm" />
              </div>
            </div>
            <Button onClick={fetchData} disabled={loading} size="sm">
              เปรียบเทียบ
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Comparison Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Period 1 */}
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">ช่วงเวลาปัจจุบัน</CardTitle>
                  <Badge variant="outline" className="text-xs">{data.period1.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">รายรับ</span>
                  <span className="text-lg font-bold">{formatCurrency(data.period1.revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">กำไร</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(data.period1.profit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ค่าใช้จ่าย</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(data.period1.expenses)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">จำนวนออร์เดอร์</span>
                  <span className="text-lg font-bold">{formatNumber(data.period1.orderCount)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Period 2 */}
            <Card className="border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">ช่วงเวลาเปรียบเทียบ</CardTitle>
                  <Badge variant="secondary" className="text-xs">{data.period2.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">รายรับ</span>
                  <span className="text-lg font-bold">{formatCurrency(data.period2.revenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">กำไร</span>
                  <span className="text-lg font-bold text-green-600">{formatCurrency(data.period2.profit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ค่าใช้จ่าย</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(data.period2.expenses)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">จำนวนออร์เดอร์</span>
                  <span className="text-lg font-bold">{formatNumber(data.period2.orderCount)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Change Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg">สรุปการเปลี่ยนแปลง</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'รายรับ', change: data.changes.revenue, inverted: false },
                  { label: 'กำไร', change: data.changes.profit, inverted: false },
                  { label: 'ค่าใช้จ่าย', change: data.changes.expenses, inverted: true },
                  { label: 'ออร์เดอร์', change: data.changes.orderCount, inverted: false },
                ].map((item, i) => (
                  <div key={i} className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1">{item.label}</p>
                    <div className="flex items-center justify-center gap-1">
                      <ChangeIndicator value={item.change} />
                      <span className={`text-2xl font-bold ${getChangeColor(item.change, item.inverted)}`}>
                        {item.change > 0 ? '+' : ''}{item.change}%
                      </span>
                    </div>
                    <Badge className={`mt-1 text-[10px] ${getChangeBadge(item.change, item.inverted)}`}>
                      {item.change > 0 ? 'เพิ่มขึ้น' : item.change < 0 ? 'ลดลง' : 'เท่าเดิม'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
