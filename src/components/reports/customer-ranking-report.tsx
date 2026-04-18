'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getCustomerRankingReport } from '@/actions/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Users, TrendingUp, Award } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';

type CustomerRankData = Awaited<ReturnType<typeof getCustomerRankingReport>>;

interface CustomerRankingReportProps {
  startDate?: string;
  endDate?: string;
}

function formatThaiDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zonedDate = toZonedTime(d, 'Asia/Bangkok');
  return format(zonedDate, 'd MMM yy', { locale: th });
}

const RANK_STYLES = [
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 ring-1 ring-yellow-300',
  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 ring-1 ring-slate-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 ring-1 ring-amber-400',
];

const RANK_EMOJI = ['🥇', '🥈', '🥉'];

export function CustomerRankingReport({ startDate, endDate }: CustomerRankingReportProps) {
  const [data, setData] = useState<CustomerRankData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCustomerRankingReport(startDate, endDate)
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

  const top3Total = data.customers.slice(0, 3).reduce((s, c) => s + c.totalSpent, 0);
  const topPercent = data.grandTotal > 0 ? Math.round((top3Total / data.grandTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ลูกค้าทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatNumber(data.totalCustomers)}</div>
            <p className="text-xs text-muted-foreground">ที่มียอดซื้อ</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ยอดขายจากลูกค้า</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatCurrency(data.grandTotal)}</div>
            <p className="text-xs text-muted-foreground">ยอดรวม Top {data.customers.length}</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Top 3 สัดส่วน</CardTitle>
            <Crown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold text-yellow-600">{topPercent}%</div>
            <p className="text-xs text-muted-foreground">ของยอดขายลูกค้า</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 3 Podium */}
      {data.customers.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {data.customers.slice(0, 3).map((c, i) => (
            <Link href={`/customers/${c.id}`} key={c.id}>
              <Card className={`hover:shadow-md transition-shadow ${RANK_STYLES[i]}`}>
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="text-2xl mb-1">{RANK_EMOJI[i]}</div>
                  <p className="font-bold text-sm truncate">{c.name}</p>
                  <p className="text-lg sm:text-xl font-bold mt-1">{formatCurrency(c.totalSpent)}</p>
                  <p className="text-[10px] mt-0.5">{c.orderCount} ครั้ง · {c.percentage}%</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Full Ranking Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              อันดับลูกค้า
            </CardTitle>
            <span className="text-xs text-muted-foreground">{data.customers.length} คน</span>
          </div>
        </CardHeader>
        <CardContent>
          {data.customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              ไม่มีข้อมูลลูกค้าในช่วงเวลานี้
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b-2 border-muted">
                    <th className="text-left py-2 px-2 font-semibold w-10">#</th>
                    <th className="text-left py-2 px-2 font-semibold">ลูกค้า</th>
                    <th className="text-right py-2 px-2 font-semibold">ยอดซื้อ</th>
                    <th className="text-right py-2 px-2 font-semibold">กำไร</th>
                    <th className="text-right py-2 px-2 font-semibold">ครั้ง</th>
                    <th className="text-right py-2 px-2 font-semibold">เฉลี่ย/บิล</th>
                    <th className="text-right py-2 px-2 font-semibold">ล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted">
                  {data.customers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 px-2">
                        {c.rank <= 3 ? (
                          <span className="text-base">{RANK_EMOJI[c.rank - 1]}</span>
                        ) : (
                          <span className="text-muted-foreground font-medium">{c.rank}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <Link href={`/customers/${c.id}`} className="hover:underline">
                          <div className="font-medium">{c.name}</div>
                          {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                        </Link>
                      </td>
                      <td className="text-right py-2 px-2 font-medium">{formatCurrency(c.totalSpent)}</td>
                      <td className={`text-right py-2 px-2 font-medium ${c.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(c.totalProfit)}
                      </td>
                      <td className="text-right py-2 px-2">{c.orderCount}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{formatCurrency(c.avgOrderValue)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground text-xs">
                        {formatThaiDate(c.lastOrderDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold bg-muted/50">
                    <td colSpan={2} className="py-3 px-2">รวม ({data.customers.length} คน)</td>
                    <td className="text-right py-3 px-2">{formatCurrency(data.grandTotal)}</td>
                    <td className="text-right py-3 px-2 text-green-600">
                      {formatCurrency(data.customers.reduce((s, c) => s + c.totalProfit, 0))}
                    </td>
                    <td className="text-right py-3 px-2">
                      {data.customers.reduce((s, c) => s + c.orderCount, 0)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
