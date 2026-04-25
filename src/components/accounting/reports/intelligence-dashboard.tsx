'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  ChevronRight,
  ArrowUpRight,
  Info,
  ChevronDown,
  LayoutGrid,
  Filter,
  Cpu,
  Zap,
  ArrowRight,
  Sparkles,
  BarChart3,
  Waves,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getInventoryIntelligence,
  getProcurementAging
} from '@/actions/core/analytics.actions';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';
import { SalesHeatmap } from './sales-heatmap';
import ReorderSuggestions from './reorder-suggestions';
import { cn } from '@/lib/utils';

/**
 * IntelligenceDashboard — The Business Intelligence Command Center (Phase 3).
 * Uses simple machine learning heuristics to categorize items for strategic decision-making.
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
      <div className="space-y-10">
        <div className="h-40 w-full bg-muted/50 animate-pulse rounded-[2.5rem]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="h-96 bg-muted/50 animate-pulse rounded-[3rem]" />
          <div className="h-96 bg-muted/50 animate-pulse rounded-[3rem]" />
          <div className="h-96 bg-muted/50 animate-pulse rounded-[3rem]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16 animate-in fade-in zoom-in-95 duration-700">
      {/* 1. High-Impact Header */}
      <div className="relative group overflow-hidden rounded-[3rem] border-2 border-primary/20 bg-primary/5 p-10 shadow-2xl shadow-primary/5">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="h-20 w-20 rounded-[2.5rem] bg-foreground text-background flex items-center justify-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                    <Sparkles className="h-10 w-10 animate-pulse" />
                </div>
                <div className="space-y-1 text-center md:text-left">
                    <h2 className="text-4xl font-black tracking-tighter">Inventory Intelligence</h2>
                    <p className="text-muted-foreground font-medium max-w-xl italic">
                        วิเคราะห์พฤติกรรมสินค้าและความแข็งแกร่งของคลังด้วยระบบ Heuristics Intelligence 
                        เพื่อหาจุดบอดของกระแสเงินสด
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-background/50 backdrop-blur-md p-2 pl-6 rounded-full border-2 shadow-lg">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Analysis Window
                </span>
                <Select value={windowDays} onValueChange={setWindowDays}>
                    <SelectTrigger className="w-[140px] h-10 rounded-full border-none bg-foreground text-background font-black shadow-inner">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-2">
                        <SelectItem value="30">30 วันล่าสุด</SelectItem>
                        <SelectItem value="60">60 วันล่าสุด</SelectItem>
                        <SelectItem value="90">90 วันล่าสุด</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
      </div>

      {/* 2. Resilience Vector Cards (The Strategic Core) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* STAR PRODUCTS — PROFIT POWER */}
        <div className="relative group">
            <div className="absolute -inset-1 bg-emerald-500/20 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
            <Card className="relative overflow-hidden rounded-[3rem] border-2 border-emerald-500/20 bg-background shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="h-32 w-32 text-emerald-600" />
                </div>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-4">
                        <span className="px-5 py-1.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-emerald-500/20">
                            Profit Power (Star)
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
                            <Waves className="h-3 w-3 text-emerald-500" />
                            <span className="text-[10px] font-bold">Velocity: High</span>
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-black tracking-tighter text-emerald-600">
                        {intelligence?.stars?.length || 0}
                    </CardTitle>
                    <CardDescription className="text-base font-bold text-foreground">สินค้าทำเงินสูงสุด</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        {intelligence?.stars?.slice(0, 3).map((p: any) => (
                            <Link key={p.id} href={`/products/${p.id}`} className="block group/item">
                                <div className="flex justify-between items-center p-4 rounded-3xl bg-muted/20 hover:bg-emerald-500/5 border border-transparent hover:border-emerald-500/20 transition-all">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-sm font-black truncate">{p.name}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{p.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-600">{formatCurrency(p.revenue)}</p>
                                        <p className="text-[10px] font-medium opacity-60">ขายแล้ว {p.qtySold} ชิ้น</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <Button variant="outline" className="w-full rounded-[1.5rem] h-12 border-2 border-emerald-500/10 text-emerald-700 font-black hover:bg-emerald-500/5" asChild>
                        <Link href="#stars">Analysis Flow <ChevronRight className="h-4 w-4 ml-2" /></Link>
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* SLUGGISH PRODUCTS — STAGNANT CAPITAL */}
        <div className="relative group">
            <div className="absolute -inset-1 bg-orange-500/20 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
            <Card className="relative overflow-hidden rounded-[3rem] border-2 border-orange-500/20 bg-background shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock className="h-32 w-32 text-orange-600" />
                </div>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-4">
                        <span className="px-5 py-1.5 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-orange-500/20">
                            Stagnant Capital (Sluggish)
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full">
                            <AlertTriangle className="h-3 w-3 text-orange-500" />
                            <span className="text-[10px] font-bold">Priority: Med</span>
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-black tracking-tighter text-orange-600">
                        {intelligence?.sluggish?.length || 0}
                    </CardTitle>
                    <CardDescription className="text-base font-bold text-foreground">สินค้าค้างคลังเกิน {windowDays} วัน</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        {intelligence?.sluggish?.slice(0, 3).map((p: any) => (
                            <Link key={p.id} href={`/products/${p.id}`} className="block group/item">
                                <div className="flex justify-between items-center p-4 rounded-3xl bg-muted/20 hover:bg-orange-500/5 border border-transparent hover:border-orange-500/20 transition-all">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-sm font-black truncate">{p.name}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">สต็อก: {p.stock} ชิ้น</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-orange-600">{formatCurrency(p.stockValue)}</p>
                                        <p className="text-[10px] font-medium opacity-60">มูลค่าจม</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <Button variant="outline" className="w-full rounded-[1.5rem] h-12 border-2 border-orange-500/10 text-orange-700 font-black hover:bg-orange-500/5" asChild>
                        <Link href="#sluggish">Cleanup Plan <ChevronRight className="h-4 w-4 ml-2" /></Link>
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* CRITICAL PRODUCTS — SUPPLY RISK */}
        <div className="relative group">
            <div className="absolute -inset-1 bg-red-500/20 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
            <Card className="relative overflow-hidden rounded-[3rem] border-2 border-red-500/20 bg-background shadow-2xl transition-all duration-500 hover:-translate-y-2">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Zap className="h-32 w-32 text-red-600" />
                </div>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-4">
                        <span className="px-5 py-1.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-red-500/20">
                            Supply Risk (Critical)
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted/50 rounded-full animate-pulse">
                            <Zap className="h-3 w-3 text-red-500 fill-current" />
                            <span className="text-[10px] font-bold text-red-600">Urgent</span>
                        </div>
                    </div>
                    <CardTitle className="text-5xl font-black tracking-tighter text-red-600">
                        {intelligence?.critical?.length || 0}
                    </CardTitle>
                    <CardDescription className="text-base font-bold text-foreground">สินค้าขาดแคลน/ต้องรีบสั่ง</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="space-y-2">
                        {intelligence?.critical?.slice(0, 3).map((p: any) => (
                            <Link key={p.id} href={`/products/${p.id}`} className="block group/item">
                                <div className="flex justify-between items-center p-4 rounded-3xl bg-muted/20 hover:bg-red-500/5 border border-transparent hover:border-red-500/20 transition-all">
                                    <div className="min-w-0 pr-2">
                                        <p className="text-sm font-black truncate">{p.name}</p>
                                        <p className="text-[10px] font-black text-red-500 uppercase">เหลือ: {p.stock} (Min: {p.minStock})</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-blue-600">{p.avgDailySales.toFixed(1)}</p>
                                        <p className="text-[10px] font-medium opacity-60">ชิ้นต่อวัน</p>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                    <Button variant="outline" className="w-full rounded-[1.5rem] h-12 border-2 border-red-500/10 text-red-700 font-black hover:bg-red-500/5" asChild>
                        <Link href="#critical">Procurement Hub <ChevronRight className="h-4 w-4 ml-2" /></Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* 3. Heatmap & Reorder Logic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-background rounded-[3rem] border-2 shadow-2xl p-8 relative overflow-hidden transition-transform hover:scale-[1.01] duration-500">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
               <SalesHeatmap />
          </div>
          <div className="bg-background rounded-[3rem] border-2 shadow-2xl p-8 relative overflow-hidden transition-transform hover:scale-[1.01] duration-500">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
               <ReorderSuggestions />
          </div>
      </div>

      {/* 4. Procurement Performance (High Fidelity Table) */}
      <Card className="rounded-[3.5rem] border-2 shadow-2xl overflow-hidden bg-background/50 backdrop-blur-xl transition-all hover:shadow-primary/5">
        <CardHeader className="p-10 border-b-2 border-dashed">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <span className="px-4 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-2 inline-block">Advanced Metrics</span>
              <CardTitle className="text-3xl font-black tracking-tight">Procurement Performance</CardTitle>
              <CardDescription className="text-base font-medium">วิเคราะห์ระยะเวลาการส่งมอบสินค้า (Lead Time) แยกตามคู่ค้า</CardDescription>
            </div>
            <div className="h-16 w-16 rounded-[1.5rem] bg-muted/50 flex items-center justify-center text-muted-foreground shadow-inner">
                <Cpu className="h-8 w-8 opacity-40" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Supplier Performance Index
              </p>
              <div className="space-y-6">
                {aging?.supplierPerformance?.map((s: any) => (
                  <div key={s.supplierName} className="space-y-3 group/bar">
                    <div className="flex justify-between text-sm">
                      <span className="font-black text-foreground/80">{s.supplierName}</span>
                      <span className={cn(
                          "font-black px-3 py-0.5 rounded-full text-xs",
                          s.avgLeadTime < 5 ? "bg-emerald-500/10 text-emerald-600" : s.avgLeadTime < 10 ? "bg-orange-500/10 text-orange-600" : "bg-red-500/10 text-red-600"
                      )}>
                        {s.avgLeadTime} วัน AVG
                      </span>
                    </div>
                    <div className="w-full bg-muted/40 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000 group-hover:brightness-110",
                            s.avgLeadTime < 5 ? 'bg-emerald-500' : s.avgLeadTime < 10 ? 'bg-orange-500' : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(100, (s.avgLeadTime / 14) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted/10 rounded-[2.5rem] border-2 border-dashed overflow-hidden">
              <div className="bg-foreground text-background p-5 text-xs font-black uppercase tracking-widest flex items-center justify-between">
                  <span>Recent Procurement Events</span>
                  <Activity className="h-4 w-4 animate-pulse" />
              </div>
              <div className="divide-y-2 divide-dashed max-h-[350px] overflow-y-auto custom-scrollbar">
                {aging?.items?.map((item: any) => (
                  <div key={item.id} className="p-5 flex justify-between items-center transition-colors hover:bg-background/50 group/row">
                    <div className="space-y-1">
                      <p className="font-black text-base">{item.purchaseNumber}</p>
                      <p className="text-xs font-bold text-muted-foreground">{item.supplierName}</p>
                    </div>
                    <div className="text-right space-y-2">
                       <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] font-bold text-muted-foreground">Lead:</span>
                            <Badge variant="outline" className={cn(
                                "text-xs font-black rounded-lg h-7 px-3",
                                item.leadTimeDays > 10 ? 'text-red-500 bg-red-50/50 border-red-200' : 'bg-background'
                            )}>
                                {item.leadTimeDays} วัน
                            </Badge>
                       </div>
                      <p className="text-[10px] font-bold text-muted-foreground tracking-tighter italic">
                        RECV: {new Date(item.receivedDate).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Insight Engine Footer */}
      <div className="bg-foreground text-background p-10 rounded-[4rem] flex flex-col lg:flex-row items-center gap-10 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-125 transition-transform duration-1000">
            <TrendingUp className="h-64 w-64" />
        </div>
        <div className="h-24 w-24 rounded-[2rem] bg-background/10 backdrop-blur-3xl flex items-center justify-center shrink-0 border border-white/10 relative z-10">
          <Info className="h-10 w-10 text-white" />
        </div>
        <div className="flex-1 space-y-3 relative z-10 text-center lg:text-left">
          <h4 className="text-3xl font-black tracking-tighter">Strategic Intelligence Insight</h4>
          <p className="text-lg text-background/60 font-medium leading-relaxed max-w-3xl">
            ในรอบ {windowDays} วันมานี้ สินค้า Sluggish มีมูลค่ารวมกว่า 
            <span className="text-white font-black mx-1 underline decoration-primary underline-offset-4 pointer-events-none">
                {formatCurrency(intelligence?.sluggish?.reduce((sum: any, p: any) => sum + p.stockValue, 0))}
            </span> 
            ซึ่งเป็นเงินทุนหมุนเวียนที่ตายตัว แนะนำให้เร่งระบายของเพื่อเพิ่มทุนให้สินค้ากลุ่ม Star และ Critical ทันที
          </p>
        </div>
        <Button variant="default" className="bg-white text-black hover:bg-white/90 rounded-[1.5rem] h-14 px-10 font-black text-base shadow-2xl relative z-10 active:scale-95 transition-all" asChild>
          <Link href="/purchases/new" className="flex items-center gap-2">
            Execute Reorder
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
