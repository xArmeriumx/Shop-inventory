'use client';

import { useState, useTransition } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
    DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Calendar, Package, FileCheck, CheckCircle2,
    Loader2, AlertCircle, ArrowRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
    exportProfitAndLossAction,
    exportBalanceSheetAction,
    exportTrialBalanceAction,
    exportAccountLedgerAction,
    exportGeneralLedgerAction
} from '@/actions/accounting/accounting.actions';
import { exportVatReportAction } from '@/actions/tax/tax.actions';
import { exportWhtEntriesAction } from '@/actions/tax/wht.actions';

export function AuditPackModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [selectedDate, setSelectedDate] = useState(new Date());

    const presets = [
        { label: 'เดือนล่าสุด (Last Month)', date: subMonths(new Date(), 1) },
        { label: 'เดือนนี้ (This Month)', date: new Date() },
    ];

    const documents = [
        { id: 'tb', name: 'Trial Balance (งบทดลอง)', action: exportTrialBalanceAction },
        { id: 'pnl', name: 'Profit & Loss (งบกำไรขาดทุน)', action: exportProfitAndLossAction },
        { id: 'bs', name: 'Balance Sheet (งบแสดงฐานะการเงิน)', action: exportBalanceSheetAction },
        { id: 'gl', name: 'General Ledger (สมุดรายวันทั่วไป)', action: exportGeneralLedgerAction },
        { id: 'vat', name: 'VAT Report (รายงานภาษีมูลค่าเพิ่ม)', action: exportVatReportAction },
        { id: 'wht', name: 'WHT Report (รายงานภาษีหัก ณ ที่จ่าย)', action: exportWhtEntriesAction },
    ];

    const triggerDownload = (data: string, filename: string) => {
        const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGeneratePack = () => {
        const startDate = startOfMonth(selectedDate);
        const endDate = endOfMonth(selectedDate);
        const dateStr = format(selectedDate, 'yyyy-MM');
        const toastId = 'audit-pack';

        startTransition(async () => {
            try {
                toast.loading('กำลังเตรียม Audit Pack...', { id: toastId });

                // 1. Profit & Loss
                const pnl = await exportProfitAndLossAction({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });
                if (pnl.success) triggerDownload(pnl.data as string, `PL_${dateStr}`);

                // 2. Balance Sheet (as of end of month)
                const bs = await exportBalanceSheetAction({
                    asOfDate: endDate.toISOString()
                });
                if (bs.success) triggerDownload(bs.data as string, `BS_${dateStr}`);

                // 3. Trial Balance
                const tb = await exportTrialBalanceAction({
                    date: endDate.toISOString()
                });
                if (tb.success) triggerDownload(tb.data as string, `TB_${dateStr}`);

                // 4. General Ledger (Full)
                const gl = await exportGeneralLedgerAction({
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });
                if (gl.success) triggerDownload(gl.data as string, `GL_${dateStr}`);

                // 5. VAT Report
                const vat = await exportVatReportAction({
                    month: selectedDate.getMonth() + 1,
                    year: selectedDate.getFullYear()
                });
                if (vat.success) triggerDownload(vat.data as string, `VAT_${dateStr}`);

                // 6. WHT Report
                const wht = await exportWhtEntriesAction({
                    month: selectedDate.getMonth() + 1,
                    year: selectedDate.getFullYear()
                });
                if (wht.success) triggerDownload(wht.data as string, `WHT_${dateStr}`);

                toast.success('ดาวน์โหลด Audit Pack ครบถ้วน', { id: toastId });
                setIsOpen(false);
            } catch (error: any) {
                toast.error('เกิดข้อผิดพลาดในการโหลด Audit Pack', { id: toastId });
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">
                    <Package className="mr-2 h-4 w-4" />
                    Download Audit Pack
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Package className="text-indigo-600" />
                        Audit Pack Generator
                    </DialogTitle>
                    <DialogDescription>
                        เตรียมชุดเอกสารมาตรฐานสำหรับการส่งสำนักงานบัญชี หรือการตรวจสอบภายใน
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6">
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase text-muted-foreground px-1">เลือกรอบเวลา (Select Period)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {presets.map((p) => (
                                <Button
                                    key={p.label}
                                    variant={format(selectedDate, 'yyyy-MM') === format(p.date, 'yyyy-MM') ? 'default' : 'outline'}
                                    className="justify-start text-xs h-12"
                                    onClick={() => setSelectedDate(p.date)}
                                >
                                    <Calendar className="mr-2 h-4 w-4 opacity-50" />
                                    {p.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg border border-indigo-100">
                        <p className="text-xs font-bold uppercase text-indigo-700 mb-3 flex items-center gap-2">
                            <FileCheck className="h-4 w-4" />
                            รายการเอกสารที่จะดาวน์โหลด ({documents.length})
                        </p>
                        <ul className="space-y-2">
                            {documents.map((doc) => (
                                <li key={doc.id} className="text-xs flex items-center justify-between group">
                                    <span className="text-slate-600 flex items-center gap-2">
                                        <ArrowRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-500" />
                                        {doc.name}
                                    </span>
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 opacity-50" />
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="text-xs text-amber-800 space-y-1">
                            <p className="font-bold">ข้อมูลนี้เป็นข้อมูลทางการ (Posted Only)</p>
                            <p>เอกสารจะถูกส่งออกเฉพาะรายการที่ลงบัญชีแล้วเท่านั้น โปรดตรวจสอบให้แน่ใจว่าได้ทำการปิดงวดและลงบัญชีครบถ้วนแล้ว</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGeneratePack}
                        disabled={isPending}
                        className="bg-slate-900 text-white min-w-[150px]"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Download Complete Pack'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
