'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { getSalesChannelReport } from '@/actions/accounting/reports.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, ShoppingBag, MessageCircle, Facebook, Globe, TrendingUp } from 'lucide-react';

type ChannelData = Awaited<ReturnType<typeof getSalesChannelReport>>;

interface SalesChannelReportProps {
  startDate?: string;
  endDate?: string;
}

const CHANNEL_CONFIG: Record<string, { icon: typeof Store; color: string; bg: string }> = {
  WALK_IN: { icon: Store, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  SHOPEE: { icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  LAZADA: { icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  LINE: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30' },
  FACEBOOK: { icon: Facebook, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
  OTHER: { icon: Globe, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-950/30' },
};

export function SalesChannelReport({ startDate, endDate }: SalesChannelReportProps) {
  const [data, setData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSalesChannelReport(startDate, endDate)
      .then(setData)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const topChannel = data.channels[0];
  const bestMarginChannel = [...data.channels].sort((a, b) => b.margin - a.margin)[0];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ยอดขายรวม</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-lg sm:text-2xl font-bold">{formatCurrency(data.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{data.channels.length} ช่องทาง</p>
          </CardContent>
        </Card>

        {topChannel && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">ช่องทางหลัก</CardTitle>
              {(() => {
                const config = CHANNEL_CONFIG[topChannel.channel] || CHANNEL_CONFIG.OTHER;
                const Icon = config.icon;
                return <Icon className={`h-4 w-4 ${config.color}`} />;
              })()}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm sm:text-lg font-bold">{topChannel.label}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(topChannel.revenue)} ({topChannel.percentage}%)</p>
            </CardContent>
          </Card>
        )}

        {bestMarginChannel && (
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Margin สูงสุด</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm sm:text-lg font-bold">{bestMarginChannel.label}</div>
              <p className="text-xs text-green-600 font-medium">{bestMarginChannel.margin}% margin</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Channel Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.channels.map((ch) => {
          const config = CHANNEL_CONFIG[ch.channel] || CHANNEL_CONFIG.OTHER;
          const Icon = config.icon;

          return (
            <Card key={ch.channel} className="overflow-hidden">
              <div className={`${config.bg} p-3 sm:p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  <span className="font-semibold text-sm">{ch.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 bg-white/80 dark:bg-black/30 rounded-full font-medium">
                    {ch.percentage}%
                  </span>
                </div>

                {/* Revenue bar */}
                <div className="h-2 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${config.color.replace('text-', 'bg-')}`}
                    style={{ width: `${ch.percentage}%` }}
                  />
                </div>
              </div>
              <CardContent className="pt-3 pb-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">ยอดขาย</p>
                    <p className="font-bold">{formatCurrency(ch.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">กำไร</p>
                    <p className={`font-bold ${ch.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(ch.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">จำนวนบิล</p>
                    <p className="font-medium">{formatNumber(ch.count)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Margin</p>
                    <p className={`font-medium ${ch.margin >= 30 ? 'text-green-600' : ch.margin >= 15 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {ch.margin}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {data.channels.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              ไม่มีข้อมูลการขายในช่วงเวลานี้
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
