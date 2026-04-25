'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Clock,
  ChevronRight,
  AlertTriangle,
  Zap,
  Info,
  Sparkles,
  BarChart3,
  Activity,
  Package
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getInventoryIntelligence,
  getProcurementAging
} from '@/actions/core/analytics.actions';
import { formatCurrency, formatDate } from '@/lib/formatters';
import Link from 'next/link';
import { SalesHeatmap } from './sales-heatmap';
import ReorderSuggestions from './reorder-suggestions';
import { cn } from '@/lib/utils';

/**
 * IntelligenceDashboard — Logic-focused Business Intelligence.
 * Simplified UI, emphasizing clear heuristics and actionable data.
 */
export function IntelligenceDashboard({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [windowDays, setWindowDays] = useState('30');
  const [intelligence, setIntelligence] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [intelData, agingData] = await Promise.all([
        getInventoryIntelligence(Number(windowDays)),
        getProcurementAging(10)
      ]);
      setIntelligence(intelData);
      setAging(agingData);
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    loadData();
  }, [loadData, windowDays]);

  if (loading && !intelligence) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Card key={i} className="h-64 bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Simplified Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-card border rounded-lg">
        <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-6 w-6" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">Inventory Intelligence</h2>
                <p className="text-sm text-muted-foreground">วิเคราะห์ความแข็งแกร่งของคลังสินค้าและกระแสเงินสดรายวัน</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Analysis Window:</span>
            <Select value={windowDays} onValueChange={setWindowDays}>
                <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="30">30 วันล่าสุด</SelectItem>
                    <SelectItem value="60">60 วันล่าสุด</SelectItem>
                    <SelectItem value="90">90 วันล่าสุด</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* 2. Logic-Focused Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* STARS */}
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Star Products</CardTitle>
                        <div className="text-3xl font-bold mt-1">{intelligence?.stars?.length || 0} รายการ</div>
                    </div>
                    <Badge className="bg-emerald-500 hover:bg-emerald-500 font-bold">Best Sellers</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    {intelligence?.stars?.slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                            <span className="font-medium truncate max-w-[150px]">{p.name}</span>
                            <span className="font-bold text-emerald-600">{formatCurrency(p.revenue)}</span>
                        </div>
                    ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                    <Link href="#stars">ดูวิเคราะห์ทั้งหมด <ChevronRight className="h-3 w-3 ml-1" /></Link>
                </Button>
            </CardContent>
        </Card>

        {/* SLUGGISH */}
        <Card>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Sluggish Inventory</CardTitle>
                        <div className="text-3xl font-bold mt-1 text-orange-600">{intelligence?.sluggish?.length || 0} รายการ</div>
                    </div>
                    <Badge variant="outline" className="text-orange-600 border-orange-200">Slow Moving</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    {intelligence?.sluggish?.slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                            <span className="font-medium truncate max-w-[150px]">{p.name}</span>
                            <span className="font-bold">{formatCurrency(p.stockValue)}</span>
                        </div>
                    ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                    <Link href="#sluggish">แผนการระบายสต็อก <ChevronRight className="h-3 w-3 ml-1" /></Link>
                </Button>
            </CardContent>
        </Card>

        {/* CRITICAL */}
        <Card className="border-red-100">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Critical Alerts</CardTitle>
                        <div className="text-3xl font-bold mt-1 text-red-600">{intelligence?.critical?.length || 0} รายการ</div>
                    </div>
                    <Badge variant="destructive" className="animate-pulse">Stock Risk</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    {intelligence?.critical?.slice(0, 3).map((p: any) => (
                        <div key={p.id} className="flex justify-between text-sm py-2 border-b last:border-0">
                            <span className="font-medium truncate max-w-[150px] text-red-600">{p.name}</span>
                            <span className="font-bold">เหลือ {p.stock}</span>
                        </div>
                    ))}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                    <Link href="#critical">สั่งซื้อเร่งด่วน <ChevronRight className="h-3 w-3 ml-1" /></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      {/* 3. Charts & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
              <CardHeader className="pb-0"><CardTitle className="text-base font-bold">Sales Frequency Heatmap</CardTitle></CardHeader>
              <CardContent><SalesHeatmap /></CardContent>
          </Card>
          <Card>
              <CardHeader className="pb-0"><CardTitle className="text-base font-bold">Dynamic Reorder Suggestions</CardTitle></CardHeader>
              <CardContent><ReorderSuggestions /></CardContent>
          </Card>
      </div>

      {/* 4. Procurement Diagnostics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>Procurement Performance</CardTitle>
          </div>
          <CardDescription>วิเคราะห์ระยะเวลาการส่งมอบ (Lead Time) แยกตามคู่ค้า</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-6">
                <h4 className="text-sm font-bold text-muted-foreground uppercase">Top Supplier KPI</h4>
                <div className="space-y-4">
                  {aging?.supplierPerformance?.map((s: any) => (
                    <div key={s.supplierName} className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span>{s.supplierName}</span>
                        <span>{s.avgLeadTime} วัน AVG</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (s.avgLeadTime / 14) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 text-xs font-bold uppercase">Recent Deliveries</div>
                <div className="divide-y max-h-[300px] overflow-y-auto">
                    {aging?.items?.map((item: any) => (
                        <div key={item.id} className="p-3 flex justify-between items-center hover:bg-muted/30 transition-colors">
                            <div className="text-sm">
                                <p className="font-bold">{item.purchaseNumber}</p>
                                <p className="text-[10px] text-muted-foreground">{item.supplierName}</p>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline" className="text-[10px]">{item.leadTimeDays} วัน</Badge>
                                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(item.receivedDate)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
