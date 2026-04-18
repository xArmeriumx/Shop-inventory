'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Receipt, 
  Package, 
  Clock, 
  Info,
  ChevronRight
} from 'lucide-react';
import { getSalesHeatmap } from '@/actions/analytics';
import { money } from '@/lib/money';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type MetricType = 'revenue' | 'bills' | 'items';

interface HeatmapData {
  buckets: { id: string; label: string }[];
  data: any[];
}

export function SalesHeatmap() {
  const [metric, setMetric] = useState<MetricType>('revenue');
  const [loading, setLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await getSalesHeatmap(30);
        setHeatmap(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <HeatmapSkeleton />;

  if (!heatmap || heatmap.data.length === 0) {
    return (
      <Card className="border-dashed flex items-center justify-center p-12 text-muted-foreground text-center">
        <div>
          <BarChart3 className="mx-auto h-10 w-10 mb-4 opacity-20" />
          <p>ไม่พบข้อมูลยอดขายในช่วง 30 วันที่ผ่านมา</p>
        </div>
      </Card>
    );
  }

  let maxVal = 0;
  heatmap.data.forEach(row => {
    heatmap.buckets.forEach(b => {
      const val = row[b.id]?.[metric] || 0;
      if (val > maxVal) maxVal = val;
    });
  });

  const getIntensity = (val: number) => {
    if (val === 0 || maxVal === 0) return 0.05;
    const ratio = val / maxVal;
    return 0.1 + (ratio * 0.85);
  };

  const getMetricLabel = (m: MetricType) => {
    if (m === 'revenue') return 'ยอดขาย (Revenue)';
    if (m === 'bills') return 'จำนวนบิล (Bills)';
    return 'จำนวนชิ้น (Items)';
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden bg-card/30 backdrop-blur-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50 mb-6">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Heatmap ยอดขายแยกตามช่วงเวลา
          </CardTitle>
          <CardDescription>
            วิเคราะห์ความหนาแน่นของยอดขายตามหมวดหมู่และเวลา (30 วันล่าสุด)
          </CardDescription>
        </div>
        <div className="flex bg-muted/50 p-1 rounded-lg border border-border/50">
          <MetricToggle metric="revenue" current={metric} onClick={() => setMetric('revenue')} icon={<BarChart3 className="h-4 w-4" />} label="ยอดขาย" />
          <MetricToggle metric="bills" current={metric} onClick={() => setMetric('bills')} icon={<Receipt className="h-4 w-4" />} label="จำนวนบิล" />
          <MetricToggle metric="items" current={metric} onClick={() => setMetric('items')} icon={<Package className="h-4 w-4" />} label="จำนวนชิ้น" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[180px_repeat(5,1fr)] gap-2 mb-4">
              <div className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider pl-2">
                หมวดหมู่สินค้า
              </div>
              {heatmap.buckets.map(b => (
                <div key={b.id} className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/30">
                  <span className="text-xs font-semibold text-foreground">{b.label}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {heatmap.data.map((row) => (
                <div key={row.category} className="grid grid-cols-[180px_repeat(5,1fr)] gap-2 items-center">
                  <div className="text-sm font-medium truncate pr-4 pl-2 flex items-center gap-2 group">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-500 transition-colors" />
                    {row.category}
                  </div>
                  {heatmap.buckets.map(b => {
                    const stats = row[b.id];
                    const val = stats?.[metric] || 0;
                    const intensity = getIntensity(val);
                    
                    return (
                      <Popover key={b.id}>
                        <PopoverTrigger asChild>
                          <div
                            className="relative h-14 rounded-xl flex items-center justify-center group cursor-pointer transition-all duration-300 border border-transparent hover:border-indigo-500/20 shadow-sm"
                            style={{ 
                              backgroundColor: val > 0 
                                ? `rgba(99, 102, 241, ${intensity})` 
                                : 'rgba(0,0,0,0.03)' 
                            }}
                          >
                            <span className={`text-xs font-bold transition-colors ${val === 0 ? 'text-muted-foreground/30' : intensity > 0.5 ? 'text-white drop-shadow-sm' : 'text-indigo-900'}`}>
                              {val > 0 ? (metric === 'revenue' ? money.short(val) : val) : ''}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="top" className="p-3 shadow-xl border-none bg-slate-900 text-white rounded-xl w-48">
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-indigo-300 flex items-center gap-1">
                              {row.category} 
                              <ChevronRight className="h-3 w-3" />
                              {b.label}
                            </p>
                            <div className="space-y-1">
                              <DetailItem icon={<BarChart3 className="h-3 w-3" />} label="ยอดขาย" value={money.format(stats.revenue)} />
                              <DetailItem icon={<Receipt className="h-3 w-3" />} label="จำนวนบิล" value={`${stats.bills} บิล`} />
                              <DetailItem icon={<Package className="h-3 w-3" />} label="สินค้า" value={`${stats.items} ชิ้น`} />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> ความเข้มสีระบุปริมาณ {getMetricLabel(metric)}</span>
            <div className="flex items-center gap-1 ml-2">
              <div className="h-3 w-3 rounded bg-indigo-500/10" />
              <span>น้อย</span>
              <div className="h-3 w-8 rounded bg-gradient-to-r from-indigo-500/20 to-indigo-600" />
              <span>มาก</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-indigo-500/5 text-indigo-600 border-indigo-500/20 px-3 py-1">
              <Clock className="h-3 w-3 mr-1.5" /> Live Analysis
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricToggle({ metric, current, onClick, icon, label }: { metric: MetricType, current: MetricType, onClick: () => void, icon: React.ReactNode, label: string }) {
  const active = metric === current;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
        active 
          ? 'bg-background text-foreground shadow-sm' 
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: `h-3.5 w-3.5 ${active ? 'text-indigo-500' : ''}` })}
      {label}
    </button>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[11px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-bold text-slate-100">{value}</span>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <Card className="border-none shadow-sm h-[500px]">
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[180px_repeat(5,1fr)] gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
