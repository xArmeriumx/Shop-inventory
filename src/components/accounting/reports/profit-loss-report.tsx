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

  if (!data?.success) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{data?.message || 'ไม่สามารถดึงข้อมูลรายงานได้'}</p>
        </CardContent>
      </Card>
    );
  }

  const reportData = data.data;
  const isNetProfitPositive = reportData.netProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-2 border-blue-500/10 shadow-xl overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">รายรับรวม</CardTitle>
            <Coins className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0 relative overflow-hidden">
             <div className="text-2xl sm:text-3xl font-black tracking-tighter transition-transform group-hover:scale-105 duration-500">{formatCurrency(reportData.revenue.total)}</div>
             <div className="mt-1">
                <ChangeIndicator value={reportData.revenue.change} />
             </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-emerald-500/10 shadow-xl overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">กำไรขั้นต้น</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-black tracking-tighter text-emerald-600 transition-transform group-hover:scale-105 duration-500">{formatCurrency(reportData.grossProfit)}</div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground opacity-60">Margin {reportData.grossMargin}%</p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-orange-500/10 shadow-xl overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">ค่าใช้จ่าย</CardTitle>
            <Receipt className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl sm:text-3xl font-black tracking-tighter text-orange-600 transition-transform group-hover:scale-105 duration-500">{formatCurrency(reportData.expenses.total)}</div>
            <div className="mt-1">
                <ChangeIndicator value={reportData.expenses.change} />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
            "rounded-[2rem] border-2 shadow-2xl overflow-hidden group relative",
            isNetProfitPositive ? "border-green-500/20 bg-green-50/50" : "border-red-500/20 bg-red-50/50"
        )}>
          <div className={cn(
              "absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity",
              isNetProfitPositive ? "text-green-600" : "text-red-600"
          )}>
            <Wallet className="h-20 w-20" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className={cn(
                "text-xs font-black uppercase tracking-widest",
                isNetProfitPositive ? "text-green-700" : "text-red-700"
            )}>★ กำไรสุทธิ</CardTitle>
            <Wallet className={cn("h-5 w-5", isNetProfitPositive ? 'text-green-600' : 'text-red-600')} />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={cn(
                "text-2xl sm:text-3xl font-black tracking-tighter transition-transform group-hover:scale-110 origin-left duration-500",
                isNetProfitPositive ? "text-green-600" : "text-red-600"
            )}>
              {formatCurrency(reportData.netProfit)}
            </div>
            <div className="mt-1">
                <ChangeIndicator value={reportData.netProfitChange} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card className="rounded-[2.5rem] border-2 shadow-2xl overflow-hidden bg-background">
        <CardHeader className="pb-4 border-b-2 border-dashed bg-muted/20">
          <CardTitle className="text-xl font-black tracking-tighter">งบกำไร-ขาดทุน (P&L Statement)</CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground italic">Accrual Basis Diagnostic</CardDescription>
        </CardHeader>
        <CardContent className="p-2 sm:p-8">
          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="bg-blue-50/50 dark:bg-blue-950/30 rounded-[2rem] p-6 border-2 border-blue-500/10">
              <h3 className="text-sm font-black uppercase tracking-widest text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  รายรับ (Revenue)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground font-medium">ยอดขายสุทธิ ({reportData.salesCount} บิล)</span>
                  <span className="font-black text-foreground">{formatCurrency(reportData.revenue.sales)}</span>
                </div>
                {reportData.revenue.discount > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground font-medium">ส่วนลดรวม</span>
                    <span className="text-red-500 font-bold">-{formatCurrency(reportData.revenue.discount)}</span>
                  </div>
                )}
                {reportData.revenue.otherIncome > 0 && (
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground font-medium">รายรับอื่น ({reportData.incomeCount} รายการ)</span>
                    <span className="font-black text-foreground">{formatCurrency(reportData.revenue.otherIncome)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black border-t-2 border-blue-500/20 pt-4 mt-2">
                  <span>รายรับรวม</span>
                  <span className="text-blue-600">{formatCurrency(reportData.revenue.total)}</span>
                </div>
              </div>
            </div>

            {/* COGS */}
            <div className="flex justify-between items-center p-6 bg-muted/30 rounded-[2rem] border-2 border-transparent">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                    <ShoppingCart className="h-5 w-5" />
                </div>
                <span className="text-base font-black text-muted-foreground">ต้นทุนขาย (COGS)</span>
              </div>
              <span className="text-xl font-black text-red-600">-{formatCurrency(reportData.cogs)}</span>
            </div>

            {/* Gross Profit Line */}
            <div className="flex justify-between items-center p-6 bg-emerald-500/5 dark:bg-emerald-950/30 rounded-[2rem] border-2 border-emerald-500/10">
              <div>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">กำไรขั้นต้น (Gross Profit)</span>
                <span className="text-xs font-black uppercase text-emerald-600/60 dark:text-emerald-500 ml-3 tracking-widest">{reportData.grossMargin}% Margin</span>
              </div>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{formatCurrency(reportData.grossProfit)}</span>
            </div>

            {/* Expenses Breakdown */}
            {reportData.expenses.byCategory.length > 0 && (
              <div className="bg-orange-50/50 dark:bg-orange-950/30 rounded-[2rem] p-6 border-2 border-orange-500/10">
                <h3 className="text-sm font-black uppercase tracking-widest text-orange-800 dark:text-orange-300 mb-4 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    ค่าใช้จ่าย (Expenses)
                </h3>
                <div className="space-y-3">
                  {reportData.expenses.byCategory.map((cat: any) => (
                    <div key={cat.category} className="flex justify-between text-base">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-medium">{cat.category}</span>
                        <span className="text-[10px] font-black text-muted-foreground/40 bg-muted px-2 py-0.5 rounded-full">{cat.percentage}%</span>
                      </div>
                      <span className="font-bold text-foreground">-{formatCurrency(cat.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xl font-black border-t-2 border-orange-500/20 pt-4 mt-2">
                    <span>ค่าใช้จ่ายรวม</span>
                    <span className="text-orange-600">-{formatCurrency(reportData.expenses.total)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Net Profit */}
            <div className={cn(
                "rounded-[2.5rem] p-8 border-2 shadow-2xl relative overflow-hidden group",
                isNetProfitPositive ? "bg-green-500 text-white border-green-600 shadow-green-500/20" : "bg-red-500 text-white border-red-600 shadow-red-500/20"
            )}>
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                  <TrendingUp className="h-32 w-32" />
              </div>
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                    {isNetProfitPositive
                        ? <TrendingUp className="h-8 w-8 text-white" />
                        : <TrendingDown className="h-8 w-8 text-white" />
                    }
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-2xl font-black tracking-tighter">
                        ★ กำไรสุทธิ (Net Profit)
                    </span>
                    <p className="text-xs font-black uppercase tracking-widest opacity-70">
                        Efficiency: {reportData.netMargin}% Net Margin
                    </p>
                  </div>
                </div>
                <div className="text-right">
                    <span className="text-3xl sm:text-5xl font-black tracking-tighter">
                        {formatCurrency(reportData.netProfit)}
                    </span>
                 </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 relative z-10">
                <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest",
                    isNetProfitPositive ? "bg-white/10 text-white" : "bg-white/10 text-white"
                )}>
                    {reportData.netProfitChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(reportData.netProfitChange)}% Growth
                </div>
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
              <p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(reportData.cashIn)}</p>
              <p className="text-[10px] text-muted-foreground">ขาย + รายรับอื่น</p>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">เงินออก</p>
              <p className="text-sm sm:text-lg font-bold text-red-600">{formatCurrency(reportData.cashOut)}</p>
              <p className="text-[10px] text-muted-foreground">ซื้อสินค้า + ค่าใช้จ่าย</p>
            </div>
            <div className={`text-center p-3 rounded-lg ${reportData.netCashFlow >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-orange-50 dark:bg-orange-950/30'}`}>
              <p className="text-xs text-muted-foreground mb-1">เงินสดสุทธิ</p>
              <p className={`text-sm sm:text-lg font-bold ${reportData.netCashFlow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {reportData.netCashFlow >= 0 ? '+' : ''}{formatCurrency(reportData.netCashFlow)}
              </p>
              <p className="text-[10px] text-muted-foreground">เงินเข้า − เงินออก</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
