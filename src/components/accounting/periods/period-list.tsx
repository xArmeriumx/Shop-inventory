'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';
import { Lock, Unlock, History, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
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

interface PeriodListProps {
    periods: any[];
}

export const PeriodList: React.FC<PeriodListProps> = ({ periods }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
    const [reopenReason, setReopenReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleClosePeriod = async (id: string, name: string) => {
        if (!confirm(`ยืนยันการปิดงวดบัญชี ${name}?\nเมื่อปิดแล้วจะไม่มีการอนุญาตให้บันทึกรายการในงวดนี้ เว้นแต่จะทำการเปิดงวดใหม่`)) return;

        setIsLoading(true);
        try {
            const res = await closePeriodAction(id);
            if (res.success) {
                toast.success(`ปิดงวดบัญชี ${name} สำเร็จ`);
            } else {
                toast.error(res.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleReopenPeriod = async () => {
        if (!reopenReason.trim()) {
            toast.error('กรุณาระบุเหตุผลในการเปิดงวดบัญชีใหม่');
            return;
        }

        setIsLoading(true);
        try {
            const res = await reopenPeriodAction({ periodId: selectedPeriod.id, reason: reopenReason });
            if (res.success) {
                toast.success(`เปิดงวดบัญชี ${selectedPeriod.periodName} ใหม่สำเร็จ`);
                setSelectedPeriod(null);
                setReopenReason('');
            } else {
                toast.error(res.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
                {periods.map((period) => (
                    <Card key={period.id} className={`border-l-4 ${period.status === 'CLOSED' ? 'border-l-rose-500 bg-rose-50/30' : 'border-l-emerald-500'}`}>
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold">{period.periodName}</h3>
                                        <Badge variant={period.status === 'CLOSED' ? 'destructive' : 'default'} className="rounded-full">
                                            {period.status === 'CLOSED' ? 'ปิดงวดแล้ว' : 'เปิดอยู่'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground italic">
                                        ช่วงเวลา: {formatDate(period.startDate)} - {formatDate(period.endDate)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {period.status === 'OPEN' ? (
                                        <Button
                                            variant="destructive"
                                            className="gap-2"
                                            onClick={() => handleClosePeriod(period.id, period.periodName)}
                                            disabled={isLoading}
                                        >
                                            <Lock size={16} />
                                            ปิดงวดบัญชี / Close
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                            onClick={() => setSelectedPeriod(period)}
                                            disabled={isLoading}
                                        >
                                            <Unlock size={16} />
                                            เปิดงวดใหม่ / Re-open
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Additional Info / Audit Trail */}
                            {period.status === 'CLOSED' && (
                                <div className="mt-4 p-3 rounded-lg bg-white/50 border border-rose-100 flex items-start gap-3">
                                    <Info size={16} className="text-rose-500 mt-1" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-semibold text-rose-700">Audit Information:</p>
                                        <p>ปิดโดย: {period.closedBy?.user?.name || 'Unknown'}</p>
                                        <p>เมื่อวันที่: {formatDate(period.closedAt)}</p>
                                        {period.reopenReason && (
                                            <p className="text-amber-700 mt-2 font-medium bg-amber-50 p-2 rounded border border-amber-100">
                                                <History size={12} className="inline mr-1" />
                                                ประวัติการเปิดใหม่: {period.reopenReason}
                                                <span className="block opacity-70 mt-1">โดย {period.reopenedBy?.user?.name} เมื่อ {formatDate(period.reopenedAt)}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
                {periods.length === 0 && (
                    <div className="p-12 text-center border-2 border-dashed rounded-xl bg-slate-50">
                        <AlertTriangle className="mx-auto text-muted-foreground mb-3" size={40} />
                        <p className="text-muted-foreground">ยังไม่มีการตั้งค่างวดบัญชีในระบบ</p>
                    </div>
                )}
            </div>

            {/* Re-open Dialog */}
            <Dialog open={!!selectedPeriod} onOpenChange={() => setSelectedPeriod(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Unlock size={20} className="text-emerald-500" />
                            ยืนยันการเปิดงวดบัญชีอีกครั้ง
                        </DialogTitle>
                        <DialogDescription>
                            การเปิดงวดบัญชี {selectedPeriod?.periodName} จะทำให้ระบบกลับมาอนุญาตการบันทึกรายการในงวดนี้ได้อีกครั้ง กรุณาระบุเหตุผลเพื่อการตรวจสอบ (Audit Log)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="ระบุเหตุผลในการแก้ไขข้อมูลย้อนหลัง..."
                            value={reopenReason}
                            onChange={(e) => setReopenReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setSelectedPeriod(null)}>ยกเลิก</Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleReopenPeriod}
                            disabled={isLoading}
                        >
                            ยืนยันการเปิดงวดใหม่
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
