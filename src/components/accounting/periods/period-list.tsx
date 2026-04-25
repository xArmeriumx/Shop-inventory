'use client';

import React, { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import { Lock, Unlock, History, Info, AlertTriangle, UserCheck, ShieldAlert } from 'lucide-react';
import { closePeriodAction, reopenPeriodAction } from '@/actions/accounting/accounting.actions';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { runActionWithToast } from '@/lib/mutation-utils';

interface PeriodListProps {
    periods: any[];
    onRefresh: () => void;
}

/**
 * PeriodList — Logic-driven display of fiscal cycles.
 * PATTERN: Uses runActionWithToast for all state transitions.
 */
export const PeriodList: React.FC<PeriodListProps> = ({ periods, onRefresh }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
    const [reopenReason, setReopenReason] = useState('');
    const [isPending, startTransition] = useTransition();

    const handleClosePeriod = (id: string, name: string) => {
        if (!confirm(`LOCK PERIOD: ยืนยันการปิดงวดบัญชี ${name}?\nข้อมูลจะกลายเป็น Immutable และไม่สามารถแก้ไขได้จนกว่าจะทำ Re-open Protocol`)) return;

        startTransition(async () => {
            await runActionWithToast(closePeriodAction(id), {
                successMessage: `งวดบัญชี ${name} ถูกล็อคเรียบร้อยแล้ว`,
                loadingMessage: "กำลังล็อคข้อมูลงวดบัญชี...",
                onSuccess: () => onRefresh()
            });
        });
    };

    const handleReopenPeriod = () => {
        if (!reopenReason.trim() || reopenReason.length < 5) {
            alert('กรุณาระบุเหตุผลในการเปิดงวดอย่างเป็นทางการ (อย่างน้อย 5 ตัวอักษร)');
            return;
        }

        startTransition(async () => {
            await runActionWithToast(reopenPeriodAction({ periodId: selectedPeriod.id, reason: reopenReason }), {
                successMessage: `งวดบัญชี ${selectedPeriod.periodName} ปลดล็อคสำเร็จ (Recorded)`,
                loadingMessage: "กำลังปลดล็อคข้อมูลงวดบัญชี...",
                onSuccess: () => {
                    setSelectedPeriod(null);
                    setReopenReason('');
                    onRefresh();
                }
            });
        });
    };

    return (
        <div className="space-y-4">
            {periods.length === 0 && (
                <div className="p-20 text-center border-4 border-dashed rounded-[3rem] bg-muted/20">
                    <AlertTriangle className="mx-auto text-muted-foreground/30 mb-6" size={64} />
                    <div className="space-y-1">
                        <p className="text-xl font-black text-muted-foreground">ระบบตรวจไม่พบงวดบัญชี</p>
                        <p className="text-sm font-medium text-muted-foreground/60 italic">ยังไม่มีการตั้งค่า Fiscal Cycles ในระบบ</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {periods.map((period) => {
                    const isClosed = period.status === 'CLOSED';
                    return (
                        <Card 
                            key={period.id} 
                            className={cn(
                                "rounded-[2.5rem] border-2 transition-all duration-300 relative overflow-hidden group",
                                isClosed ? "bg-muted/30 border-rose-500/10" : "bg-background border-emerald-500/10 shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-1"
                            )}
                        >
                            <CardContent className="p-8">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 py-2">
                                    <div className="flex items-center gap-6">
                                        <div className={cn(
                                            "h-16 w-16 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                                            isClosed ? "bg-rose-100/50 text-rose-600" : "bg-emerald-100 text-emerald-600"
                                        )}>
                                            {isClosed ? <Lock size={28} /> : <Unlock size={28} />}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-black tracking-tighter">{period.periodName}</h3>
                                                <Badge 
                                                    variant={isClosed ? 'destructive' : 'default'} 
                                                    className={cn(
                                                        "rounded-full px-4 h-7 text-[10px] font-black uppercase tracking-widest border-none",
                                                        !isClosed && "bg-emerald-500 hover:bg-emerald-600"
                                                    )}
                                                >
                                                    {isClosed ? 'LOCKED' : 'ACTIVE'}
                                                </Badge>
                                            </div>
                                            <p className="text-xs font-black text-muted-foreground opacity-60 uppercase tracking-widest">
                                                Diag: {formatDate(period.startDate)} — {formatDate(period.endDate)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {!isClosed ? (
                                            <Button
                                                variant="destructive"
                                                className="rounded-full h-12 px-8 font-black gap-2 shadow-xl shadow-rose-500/10"
                                                onClick={() => handleClosePeriod(period.id, period.periodName)}
                                                disabled={isPending}
                                            >
                                                <ShieldAlert size={18} />
                                                Lock Period
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="rounded-full h-12 px-8 font-black gap-2 border-2 hover:bg-emerald-50 transition-all"
                                                onClick={() => setSelectedPeriod(period)}
                                                disabled={isPending}
                                            >
                                                <Unlock size={18} />
                                                Re-open Protocol
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Audit & Evidence Section */}
                                {isClosed && (
                                    <div className="mt-8 p-6 rounded-[2rem] bg-background/50 border-2 border-dashed border-rose-500/10 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <div className="p-2 rounded-lg bg-rose-50 shadow-inner">
                                                    <UserCheck size={14} className="text-rose-500" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="font-black uppercase tracking-widest text-[10px] opacity-60">Locked By</p>
                                                    <p className="font-bold text-foreground">{period.closedBy?.user?.name || 'Administrator'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                <div className="p-2 rounded-lg bg-rose-50 shadow-inner">
                                                    <History size={14} className="text-rose-500" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="font-black uppercase tracking-widest text-[10px] opacity-60">Lock Sequence</p>
                                                    <p className="font-bold text-foreground">{formatDate(period.closedAt)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {period.reopenReason && (
                                            <div className="bg-amber-500/5 rounded-2xl p-5 border-2 border-amber-500/10 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 flex items-center gap-2">
                                                    <AlertTriangle size={12} />
                                                    Re-open History / Justification
                                                </p>
                                                <p className="text-sm font-medium italic text-foreground/80 leading-relaxed">
                                                    &quot;{period.reopenReason}&quot;
                                                </p>
                                                <div className="pt-2 border-t border-amber-500/10 flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                                     By {period.reopenedBy?.user?.name} at {formatDate(period.reopenedAt)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Re-open Dialog — Logic Forced */}
            <Dialog open={!!selectedPeriod} onOpenChange={() => setSelectedPeriod(null)}>
                <DialogContent className="rounded-[3rem] border-2 p-10 max-w-xl">
                    <DialogHeader className="space-y-4">
                        <div className="h-16 w-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-2">
                             <Unlock size={32} />
                        </div>
                        <DialogTitle className="text-3xl font-black tracking-tighter">
                            Re-open Protocol
                        </DialogTitle>
                        <DialogDescription className="text-base font-medium leading-relaxed">
                            คุณกำลังทำรายการปลดล็อคข้อมูลย้อนหลังสำหรับงวดบัญชี <span className="text-foreground font-black underline underline-offset-4 decoration-emerald-500">{selectedPeriod?.periodName}</span> กรุณาระบุเหตุผลประกอบการตรวจสอบ (Audit Log)
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-6">
                        <Textarea
                            placeholder="ระบุเหตุผลในการแก้ไขข้อมูลย้อนหลังที่ชัดเจน (เช่น พบข้อผิดพลาดในการบันทึกค่าขนส่ง)..."
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            rows={5}
                            className="rounded-[1.5rem] border-2 p-4 font-medium focus-visible:ring-emerald-500/20"
                        />
                    </div>

                    <DialogFooter className="gap-3">
                        <Button variant="ghost" onClick={() => setSelectedPeriod(null)} className="rounded-full h-12 px-8 font-black">
                            ยกเลิก
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700 rounded-full h-12 px-10 font-black shadow-xl shadow-emerald-600/20"
                            onClick={handleReopenPeriod}
                            disabled={isPending}
                        >
                            ยืนยันการเปิดงวดใหม่
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
