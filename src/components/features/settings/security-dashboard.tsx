'use client';

import { useState, useEffect } from 'react';
import { getSecurityDashboardData } from '@/actions/security-dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ShieldAlert, Activity, UserX, Settings, Box, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

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
      <div className="flex h-32 items-center justify-center border rounded-lg bg-muted/20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access Denied (วันนี้)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.metrics.deniedToday} ครั้ง</div>
            <p className="text-xs text-muted-foreground mt-1">ผู้ใช้พยายามเข้าถึงเมนูที่ไม่มีสิทธิ์</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rate Limits Hit (วันนี้)</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data.metrics.rateLimitToday} ครั้ง</div>
            <p className="text-xs text-muted-foreground mt-1">การเรียกใช้งาน API เกินโควต้า</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auth Anomalies (ล่าสุด)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recentAnomalies.length} ครั้ง</div>
            <p className="text-xs text-muted-foreground mt-1">การบังคับ Logout ทุกอุปกรณ์</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid Row */}
      <div className="grid gap-4 md:grid-cols-2">
        
        {/* Left Col: Sensitive Actors */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <UserX className="w-4 h-4 mr-2" /> Top Actors (Sensitive Actions 30 วัน)
            </CardTitle>
            <CardDescription>จัดอันดับรหัสผู้ใช้ที่มีการแก้ไขสิทธิ์ลบคน หรือตั้งค่าร้านค้าสูงสุด</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-right">จำนวนครั้ง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topSensitiveActors?.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">ไม่พบข้อมูล</TableCell></TableRow>
                ) : (
                  data.topSensitiveActors?.map((actor: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{actor.actorUserId}</TableCell>
                      <TableCell className="text-right">{actor._count?.action}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Col: Recent Manual Stock */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <Box className="w-4 h-4 mr-2" /> ปรับสต็อก/ตั้งค่าร้านค้า (ล่าสุด)
            </CardTitle>
            <CardDescription>การปรับสต็อกด้วยมือ หรือเปลี่ยนแปลงความปลอดภัยระบบล่าสุด</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>รายละเอียดกิจกรรม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.recentManualStocks, ...data.recentSettingsChanges]
                  .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 5)
                  .map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(log.createdAt), 'dd/MM HH:mm')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.note && <span>{log.note}</span>}
                        {log.changedFields?.length > 0 && <span>แก้ตั้งค่าร้าน ({log.changedFields.join(', ')})</span>}
                        <br/>
                        <span className="text-muted-foreground font-mono">By: {log.actorUserId.slice(-6)}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recentManualStocks.length === 0 && data.recentSettingsChanges.length === 0 && (
                     <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-4">ไม่พบกิจกรรม</TableCell></TableRow>
                  )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
