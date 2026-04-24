'use client';

import React, { useState, useEffect } from 'react';
import { PeriodList } from '@/components/accounting/periods/period-list';
import { getAccountingPeriodsAction } from '@/actions/accounting/accounting.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, LayoutList, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function AccountingPeriodsPage() {
    const [periods, setPeriods] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await getAccountingPeriodsAction();
            if (res.success) {
                // Properly extract data from ActionResponse wrapper
                setPeriods(res.data as any[]);
            } else {
                toast.error(res.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                        <CalendarDays size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">ปิดงวดบัญชี (Accounting Periods)</h1>
                        <p className="text-muted-foreground">บริหารจัดการสถานะการเปิด-ปิดงวดบัญชีรายเดือน</p>
                    </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={fetchData} disabled={isLoading}>
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    รีเฟรช
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
                        </div>
                    ) : (
                        <PeriodList periods={periods} />
                    )}
                </div>

                <div className="space-y-6">
                    <Card className="bg-slate-900 text-white border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-xl">แนวทางปฏิบัติ (Policy)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm opacity-90">
                            <div className="p-4 bg-white/10 rounded-lg space-y-2">
                                <p className="font-bold">1. ล็อคข้อมูล (Period Lock)</p>
                                <p>เมื่องวดถูกปิด ระบบจะไม่อนุญาตการเพิ่ม/แก้ไข/ยกเลิกรายการใดๆ ที่มีผลต่อตัวเลขทางบัญชีในเดือนนั้น</p>
                            </div>
                            <div className="p-4 bg-white/10 rounded-lg space-y-2">
                                <p className="font-bold">2. แก้ไขย้อนหลัง (Adjustment)</p>
                                <p>หากมีความจำเป็นต้องแก้ไขข้อมูลในงวดที่ปิดไปแล้ว ต้องทำรายการ &apos;เปิดงวดใหม่ (Re-open)&apos; พร้อมระบุเหตุผลที่ชัดเจน</p>
                            </div>
                            <div className="p-4 bg-white/10 rounded-lg space-y-2">
                                <p className="font-bold">3. การกระทบยอด (Reconciliation)</p>
                                <p>ควรตรวจสอบงบทดลอง (Trial Balance) ให้เรียบร้อยก่อนทำการปิดงวดเสมอ</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">สรุปสถานะปีปัจจุบัน</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between py-2 border-b">
                                <span className="text-sm">งวดที่ปิดแล้ว</span>
                                <Badge variant="destructive">{periods.filter(p => p.status === 'CLOSED').length}</Badge>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm">งวดที่ยังเปิดอยู่</span>
                                <Badge variant="outline" className="border-emerald-500 text-emerald-700">{periods.filter(p => p.status === 'OPEN').length}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
