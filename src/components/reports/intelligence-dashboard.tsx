'use client';

import { useState, useEffect } from 'react';
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
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getInventoryIntelligence, 
  getProcurementAging 
} from '@/actions/analytics';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';
import { SalesHeatmap } from './sales-heatmap';
import ReorderSuggestions from './reorder-suggestions';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export function IntelligenceDashboard({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [windowDays, setWindowDays] = useState('30');
  const [intelligence, setIntelligence] = useState<any>(null);
  const [aging, setAging] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [windowDays]);

  async function loadData() {
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
  }

  if (loading && !intelligence) {
    return (
      <div className="grid gap-6">
        <div className="h-64 w-full bg-muted animate-pulse rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
          <div className="h-96 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Header & Window Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-xl border">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-primary" />
            วิเคราะห์สต็อกอัจฉริยะ (Inventory Intelligence)
          </h2>
          <p className="text-sm text-muted-foreground">ใช้แมชชีนเลิร์นนิ่งอย่างง่ายในการจัดกลุ่มสินค้าเพื่อการสั่งซื้อ</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">ดูย้อนหลัง:</span>
          <Select value={windowDays} onValueChange={setWindowDays}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 วัน</SelectItem>
              <SelectItem value="60">60 วัน</SelectItem>
              <SelectItem value="90">90 วัน</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2. Velocity Summary Cards (Star, Sluggish, Critical) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Star Products */}
        <Card className="border-green-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="h-20 w-20 text-green-600" />
          </div>
          <CardHeader>
            <div className="flex justify-between items-center">
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">🌟 ดาวรุ่ง (Star)</Badge>
              <span className="text-xs text-muted-foreground">ยอดขายสูงสุด {windowDays} วัน</span>
            </div>
            <CardTitle className="text-3xl font-black mt-2">{intelligence?.stars?.length || 0}</CardTitle>
            <CardDescription>สินค้าที่ทำรายได้หลักให้ร้าน</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intelligence?.stars?.slice(0, 3).map((p: any) => (
                <Link key={p.id} href={`/products/${p.id}`} className="block">
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(p.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground">ขายได้ {p.qtySold} ชิ้น</p>
                    </div>
                  </div>
                </Link>
              ))}
              <Button variant="ghost" className="w-full text-xs h-8 text-green-700" asChild>
                <Link href="#stars">ดูทั้งหมด <ChevronDown className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sluggish Products */}
        <Card className="border-orange-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="h-20 w-20 text-orange-600" />
          </div>
          <CardHeader>
            <div className="flex justify-between items-center">
              <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">🐢 ค้างคลัง (Sluggish)</Badge>
              <span className="text-xs text-muted-foreground">ไม่ขยับ {windowDays} วัน</span>
            </div>
            <CardTitle className="text-3xl font-black mt-2">{intelligence?.sluggish?.length || 0}</CardTitle>
            <CardDescription>ของเหลือเยอะแต่ไม่มีคนซื้อ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intelligence?.sluggish?.slice(0, 3).map((p: any) => (
                <Link key={p.id} href={`/products/${p.id}`} className="block">
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">สต็อก: {p.stock} ชิ้น</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">{formatCurrency(p.stockValue)}</p>
                      <p className="text-[10px] text-muted-foreground">เงินจม</p>
                    </div>
                  </div>
                </Link>
              ))}
              <Button variant="ghost" className="w-full text-xs h-8 text-orange-700" asChild>
                <Link href="#sluggish">ดูทั้งหมด <ChevronDown className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Critical Products */}
        <Card className="border-red-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="h-20 w-20 text-red-600" />
          </div>
          <CardHeader>
            <div className="flex justify-between items-center">
              <Badge variant="destructive" className="bg-red-100 text-red-700 border-none">🔥 ของต้องรีบสั่ง (Critical)</Badge>
              <span className="text-xs text-muted-foreground">ขายไวแต่สต็อกต่ำ</span>
            </div>
            <CardTitle className="text-3xl font-black mt-2">{intelligence?.critical?.length || 0}</CardTitle>
            <CardDescription>เสี่ยงเสียโอกาสในการขาย</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {intelligence?.critical?.slice(0, 3).map((p: any) => (
                <Link key={p.id} href={`/products/${p.id}`} className="block">
                  <div className="flex justify-between items-center p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-red-600 font-bold">เหลือ: {p.stock} (Min: {p.minStock})</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">{p.avgDailySales.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">ชิ้น/วัน</p>
                    </div>
                  </div>
                </Link>
              ))}
              <Button variant="ghost" className="w-full text-xs h-8 text-red-700" asChild>
                <Link href="#critical">ดูทั้งหมด <ChevronDown className="h-3 w-3 ml-1" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2.5 Sales Heatmap Analysis */}
      <SalesHeatmap />

      {/* 2.6 Smart Reorder Suggestions */}
      <ReorderSuggestions />

      {/* 3. Procurement Aging Analysis */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>ประสิทธิภาพการสั่งซื้อ (Procurement Performance)</CardTitle>
              <CardDescription>วิเคราะห์ระยะเวลาตั้งแต่ขอซื้อ (PR) จนถึงของมาส่งจริง (Received)</CardDescription>
            </div>
            <Clock className="h-6 w-6 text-muted-foreground opacity-50" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Lead Time เฉลี่ยแยกคู่ค้า</p>
              <div className="space-y-4">
                {aging?.supplierPerformance?.map((s: any) => (
                  <div key={s.supplierName} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{s.supplierName}</span>
                      <span className="font-bold">{s.avgLeadTime} วัน</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          s.avgLeadTime < 5 ? 'bg-green-500' : s.avgLeadTime < 10 ? 'bg-orange-500' : 'bg-red-500'
                        }`} 
                        style={{ width: `${Math.min(100, (s.avgLeadTime / 14) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-muted/50 p-3 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">ประวัติการสั่งซื้อล่าสุด</div>
              <div className="divide-y max-h-[250px] overflow-y-auto">
                {aging?.items?.map((item: any) => (
                  <div key={item.id} className="p-3 flex justify-between items-center text-sm">
                    <div>
                      <p className="font-bold">{item.purchaseNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{item.supplierName}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={item.leadTimeDays > 10 ? 'text-red-600 bg-red-50 border-red-100' : ''}>
                        {item.leadTimeDays} วัน
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(item.receivedDate).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Insight Footer */}
      <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 flex flex-col md:flex-row items-center gap-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Info className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-primary">Intelligence Insight</h4>
          <p className="text-sm text-foreground/80 leading-relaxed mt-1">
            ในรอบ {windowDays} วันที่ผ่านมา คุณมีสินค้า <strong>{intelligence?.sluggish?.length} รายการ</strong> ที่ไม่ขยับเลย 
            คิดเป็นมูลค่าเงินจมในสต็อก <strong>{formatCurrency(intelligence?.sluggish?.reduce((sum: any, p: any) => sum + p.stockValue, 0))}</strong>.
            แนะนำให้ทำโปรโมชั่นเพื่อระบายของ หรือตรวจสอบพิกัดการวางหน้าร้านใหม่
          </p>
        </div>
        <Button variant="default" className="shadow-lg shadow-primary/20" asChild>
          <Link href="/purchases/new">สั่งของเข้าเพื่อแก้ Critical</Link>
        </Button>
      </div>
    </div>
  );
}
