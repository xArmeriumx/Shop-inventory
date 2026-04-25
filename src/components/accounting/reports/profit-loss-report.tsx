'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { getProfitLossReport } from '@/actions/accounting/reports.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Minus, Receipt, ShoppingCart, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';

type PLData = Awaited<ReturnType<typeof getProfitLossReport>>;

interface ProfitLossReportProps {
  startDate?: string;
  endDate?: string;
}

function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> คงที่</span>;
  const isPositive = value > 0;
  return (
    <span className={cn("text-xs font-bold flex items-center gap-0.5", isPositive ? 'text-emerald-600' : 'text-red-600')}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}{suffix}
    </span>
  );
}

/**
 * ProfitLossReport — Logic-focused Financial Summary.
 * Simplified UI as per user request.
 */
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-24 bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="py-12 text-center text-muted-foreground bg-muted/20 border rounded-lg">
          {data?.message || 'ไม่สามารถดึงข้อมูลรายงานได้'}
      </div>
    );
  }

  const reportData = data.data;
  const isNetProfitPositive = reportData.netProfit >= 0;

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">รายรับรวม</CardTitle>
            <Coins className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(reportData.revenue.total)}</div>
            <ChangeIndicator value={reportData.revenue.change} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">กำไรขั้นต้น</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">{formatCurrency(reportData.grossProfit)}</div>
            <p className="text-[10px] font-medium text-muted-foreground mt-1">Margin {reportData.grossMargin}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground">ค่าใช้จ่าย</CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-orange-600">{formatCurrency(reportData.expenses.total)}</div>
            <ChangeIndicator value={reportData.expenses.change} />
          </CardContent>
        </Card>

        <Card className={cn("shadow-none border-2", isNetProfitPositive ? "border-emerald-500/20" : "border-red-500/20")}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className={cn("text-xs font-bold uppercase", isNetProfitPositive ? "text-emerald-700" : "text-red-700")}>กำไรสุทธิ</CardTitle>
            <Wallet className={cn("h-4 w-4", isNetProfitPositive ? 'text-emerald-500' : 'text-red-500')} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-xl font-bold", isNetProfitPositive ? "text-emerald-600" : "text-red-600")}>
              {formatCurrency(reportData.netProfit)}
            </div>
            <ChangeIndicator value={reportData.netProfitChange} />
          </CardContent>
        </Card>
      </div>

      {/* 2. P&L Breakdown Table Area */}
      <Card>
        <CardHeader className="p-4 border-b bg-muted/10">
          <CardTitle className="text-base font-bold">งบกำไร-ขาดทุน (P&L Detailed Analysis)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y text-sm">
            {/* Revenue */}
            <div className="p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase text-blue-700">รายรับ (Revenue)</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ยอดขายสุทธิ ({reportData.salesCount} บิล)</span>
                  <span className="font-medium">{formatCurrency(reportData.revenue.sales)}</span>
                </div>
                {reportData.revenue.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ส่วนลดรวม</span>
                    <span className="text-red-500">-{formatCurrency(reportData.revenue.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>รายรับรวม</span>
                  <span className="text-blue-600">{formatCurrency(reportData.revenue.total)}</span>
                </div>
              </div>
            </div>

            {/* Expenses (COGS & Operations) */}
            <div className="p-4 bg-muted/5 space-y-3">
              <div className="flex justify-between">
                <span className="font-bold">ต้นทุนขาย (COGS)</span>
                <span className="font-bold text-red-600">-{formatCurrency(reportData.cogs)}</span>
              </div>
              <div className="flex justify-between p-3 bg-emerald-50 rounded border border-emerald-100">
                <span className="font-bold text-emerald-700">กำไรขั้นต้น (Gross Profit)</span>
                <span className="font-bold text-emerald-700">{formatCurrency(reportData.grossProfit)}</span>
              </div>
              
              <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold uppercase text-orange-700">ค่าใช้จ่าย (Operating Expenses)</h3>
                  {reportData.expenses.byCategory.map((cat: any) => (
                    <div key={cat.category} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{cat.category} ({cat.percentage}%)</span>
                        <span>-{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>ค่าใช้จ่ายกิจกรรมรวม</span>
                    <span className="text-orange-600">-{formatCurrency(reportData.expenses.total)}</span>
                  </div>
              </div>
            </div>

            {/* Net Result */}
            <div className={cn("p-6 flex justify-between items-center", isNetProfitPositive ? "bg-emerald-50/50" : "bg-red-50/50")}>
                <div className="flex items-center gap-2">
                    {isNetProfitPositive ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
                    <span className="text-lg font-bold">กำไรสุทธิ (Net Profit)</span>
                    <span className="text-xs text-muted-foreground ml-2">({reportData.netMargin}%)</span>
                </div>
                <div className={cn("text-2xl font-bold", isNetProfitPositive ? "text-emerald-700" : "text-red-700")}>
                    {formatCurrency(reportData.netProfit)}
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
