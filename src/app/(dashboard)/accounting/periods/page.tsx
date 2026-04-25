'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PeriodList } from '@/components/accounting/periods/period-list';
import { getAccountingPeriodsAction } from '@/actions/accounting/accounting.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ShieldCheck, Lock, Unlock, ClipboardList, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * AccountingPeriodsPage — Fiscal Governance Hub (Phase 3).
 * Manages the opening and closing of accounting periods for data integrity.
 * FOCUS: Clean Logic & Direct Auditability.
 */
export default function AccountingPeriodsPage() {
    const [periods, setPeriods] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getAccountingPeriodsAction();
            if (res.success) {
                setPeriods(res.data as any[]);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error("Failed to connect to accounting service.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const [isInitializing, setIsInitializing] = useState(false);

    const handleInitialize = async () => {
        setIsInitializing(true);
        try {
            const { initializePeriodsAction } = await import('@/actions/accounting/accounting.actions');
            const res = await initializePeriodsAction();
            if (res.success) {
                toast.success("ตั้งค่างวดบัญชีเริ่มต้นสำเร็จ");
                fetchData();
            } else {
                toast.error(res.message);
            }
        } finally {
            setIsInitializing(false);
        }
    };

    const activePeriods = periods.filter(p => p.status === 'OPEN').length;
    const closedPeriods = periods.filter(p => p.status === 'CLOSED').length;

    return (
        <div className="container max-w-7xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            {/* 1. Governance Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-background/50 p-8 rounded-[2.5rem] border-2 shadow-sm">
                <div className="flex items-center gap-5">
                    <div className="h-16 w-16 bg-foreground text-background rounded-2xl flex items-center justify-center shadow-xl">
                        <ShieldCheck size={32} />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tighter">Fiscal Governance Hub</h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2">
                             <Lock size={14} className="text-muted-foreground/60" />
                             บริหารจัดการความปลอดภัยของงวดบัญชีและสถานะข้อมูลย้อนหลัง
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {periods.length === 0 && !isLoading && (
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-full px-8 h-12 font-black shadow-lg shadow-emerald-600/20"
                            onClick={handleInitialize}
                            disabled={isInitializing}
                        >
                            {isInitializing ? <RefreshCw size={16} className="animate-spin mr-2" /> : <ClipboardList size={16} className="mr-2" />}
                            เริ่มต้นตั้งค่างวดบัญชี
                        </Button>
                    )}
                    <Button 
                        variant="outline" 
                        className="rounded-full px-6 h-12 gap-2 font-black shadow-sm" 
                        onClick={fetchData} 
                        disabled={isLoading}
                    >
                        <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
                        Refresh Status
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* 2. Main Diagnostic Column */}
                <div className="lg:col-span-3 space-y-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-[2rem]" />
                            ))}
                        </div>
                    ) : (
                        <PeriodList periods={periods} />
                    )}
                </div>

                {/* 3. Policy & Status Sidebar */}
                <div className="space-y-8">
                    {/* Summary Card */}
                    <Card className="rounded-[2.5rem] border-2 shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/40 border-b-2 border-dashed">
                             <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                 <ClipboardList size={14} />
                                 Status Summary
                             </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold opacity-70">Closed / Locked</span>
                                <Badge variant="destructive" className="rounded-lg px-3 py-1 font-black">{closedPeriods}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold opacity-70">Open / Active</span>
                                <Badge variant="outline" className="border-emerald-500 text-emerald-700 rounded-lg px-3 py-1 font-black">
                                    {activePeriods}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Governance Playbook */}
                    <Card className="rounded-[2.5rem] bg-foreground text-background border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-1000">
                            <Lock size={120} />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-xl font-black tracking-tight">Governance Playbook</CardTitle>
                            <CardDescription className="text-background/50 font-bold uppercase tracking-widest text-[10px]">Security Protocols</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 relative z-10">
                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                    <Lock size={14} />
                                    1. Immutable Lock
                                </p>
                                <p className="text-sm font-medium text-background/70 leading-relaxed">
                                    เมื่องวดบัญชีถูกปิด ระบบจะทำลายสิทธิ์การเข้าถึงข้อมูลเพื่อแก้ไขย้อนหลังโดยอัตโนมัติ
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                    <Unlock size={14} />
                                    2. Re-open Protocol
                                </p>
                                <p className="text-sm font-medium text-background/70 leading-relaxed">
                                    การแก้ไขย้อนหลังต้องทำผ่าน Re-open Protocol พร้อมระบุบันทึกเหตุผล (Audit Reason) เท่านั้น
                                </p>
                            </div>

                            <div className="p-4 bg-background/5 rounded-2xl border border-white/10 flex items-start gap-3">
                                <Info size={16} className="text-primary shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-background/60 italic">
                                    ควรกระทบยอดธนาคารและตรวจสอบงบทดลองให้เรียบร้อยก่อนปิดงวดเสมอ
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
