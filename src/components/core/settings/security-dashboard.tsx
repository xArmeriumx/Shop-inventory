'use client';

import { useState, useEffect } from 'react';
import { getSecurityDashboardData } from '@/actions/core/security-dashboard.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShieldAlert, Activity, UserX, Settings, Box, Loader2, History, TrendingDown, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function SecurityDashboardCards() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getSecurityDashboardData();
      if (res.success) {
        setData(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center h-64 border rounded-xl bg-muted/20 border-dashed animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
        <p className="text-sm text-muted-foreground font-medium italic">กำลังวิเคราะห์ข้อมูลความปลอดภัยระบบ...</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-destructive">Unauthorized Attempts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-destructive">{data.metrics.deniedToday} <span className="text-xs font-normal opacity-70">ครั้งวันนี้</span></div>
            <p className="text-[11px] text-destructive/70 mt-1 flex items-center gap-1">
               <TrendingDown className="h-3 w-3" /> ยับยั้งการเข้าถึงที่ไม่ได้รับอนุญาต
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-orange-700">API Rate Limits</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">{data.metrics.rateLimitToday} <span className="text-xs font-normal opacity-70">ครั้งวันนี้</span></div>
            <p className="text-[11px] text-orange-600/70 mt-1">การเรียกใช้งาน API ที่เกินขอบเขตปกติ</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-blue-700">Security Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-600">{data.recentAnomalies.length} <span className="text-xs font-normal opacity-70">ล่าสุด</span></div>
            <p className="text-[11px] text-blue-600/70 mt-1">เหตุการณ์ความปลอดภัยที่ควรตรวจสอบ</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid Row */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Left Col: Sensitive Actors */}
        <Card className="col-span-1 border-none shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center"><UserX className="w-4 h-4 mr-2 text-primary" /> เฝ้าระวังตัวตน (Top Sensitive Actors)</span>
              <Badge variant="outline" className="text-[10px] font-normal">30 วันล่าสุด</Badge>
            </CardTitle>
            <CardDescription className="text-xs">รหัสผู้ใช้ที่มีการแก้ไขสิทธิ์ หรือตั้งค่าระบบสูงสุดในช่วงเดือนที่ผ่านมา</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs h-9">User Identity Indicator</TableHead>
                    <TableHead className="text-right text-xs h-9">Sensitive Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topSensitiveActors?.length === 0 ? (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-10 italic text-xs">ยังไม่มีข้อมูลกิจกรรมที่ละเอียดอ่อนในขณะนี้</TableCell></TableRow>
                  ) : (
                    data.topSensitiveActors?.map((actor: any, idx: number) => (
                      <TableRow key={idx} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-mono text-[11px] flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                           {actor.actorUserId}
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">{actor._count?.action} ครั้ง</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Recent Changes */}
        <Card className="col-span-1 border-none shadow-md overflow-hidden">
          <CardHeader className="bg-muted/30">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center"><History className="w-4 h-4 mr-2 text-primary" /> ประวัติความปลอดภัยล่าสุด</span>
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20">Real-time Feed</Badge>
            </CardTitle>
            <CardDescription className="text-xs">บันทึกการปรับสต็อกมือ และการเปลี่ยนการตั้งค่าระบบที่มีความสำคัญ</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {[...data.recentManualStocks, ...data.recentSettingsChanges]
                .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)
                .map((log: any) => (
                  <div key={log.id} className="flex gap-3 p-3 rounded-xl border bg-card hover:border-primary/30 transition-all group">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                      log.targetType === 'Shop' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                    )}>
                       {log.targetType === 'Shop' ? <Settings className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground/70">
                             {format(new Date(log.createdAt), 'dd MMMM HH:mm', { locale: th })}
                          </span>
                       </div>
                       <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {log.note || (log.changedFields?.length > 0 ? `แก้ไขตั้งค่าร้าน (${log.changedFields.join(', ')})` : 'ไม่ระบุรายละเอียด')}
                       </p>
                       <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/20 opacity-70">By: {log.actorUserId.slice(-6).toUpperCase()}</Badge>
                       </div>
                    </div>
                  </div>
                ))}
              {data.recentManualStocks.length === 0 && data.recentSettingsChanges.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl gap-2">
                    <LayoutDashboard className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">ยังไม่มีกิจกรรมที่น่าสงสัยล่าสุด</p>
                 </div>
              )}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
