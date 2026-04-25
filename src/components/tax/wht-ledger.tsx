'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { FileCheck, AlertCircle, Printer, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getWhtEntriesAction, issueWhtCertificateAction } from '@/actions/tax/wht.actions';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';

interface WhtLedgerProps {
    initialData: any;
    shop: any;
}

export function WhtLedger({ initialData, shop }: WhtLedgerProps) {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [entries, setEntries] = useState(initialData?.data || []);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getWhtEntriesAction({ year, month });
            if (result.success && result.data) {
                setEntries((result.data as any).data);
            }
        } catch (error) {
            toast.error('ไม่สามารถดึงข้อมูลได้');
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleIssue = async (entryId: string) => {
        startTransition(async () => {
            await runActionWithToast(issueWhtCertificateAction(entryId), {
                successMessage: 'ออกหนังสือรับรองภาษีหัก ณ ที่จ่าย (50 ทวิ) สำเร็จ',
                onSuccess: () => fetchEntries()
            });
        });
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">เดือน:</span>
                    <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 12 }).map((_, i) => (
                                <SelectItem key={i + 1} value={(i + 1).toString()}>
                                    {new Date(0, i).toLocaleString('th-TH', { month: 'long' })}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">ปี:</span>
                    <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[year - 1, year, year + 1].map((y) => (
                                <SelectItem key={y} value={y.toString()}>{y + 543}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>วันที่จ่าย</TableHead>
                            <TableHead>ผู้รับเงิน (Payee)</TableHead>
                            <TableHead>ประเภทเงินได้</TableHead>
                            <TableHead className="text-right">ยอดเงินก่อนหัก</TableHead>
                            <TableHead className="text-right">ภาษีที่หัก (WHT)</TableHead>
                            <TableHead>สถานะใบรับรอง</TableHead>
                            <TableHead className="text-right">จัดการ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-8 h-8 opacity-20" />
                                        <span>ไม่มีรายการหัก ณ ที่จ่ายในเดือนที่เลือก</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            entries.map((entry: any) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="text-sm whitespace-nowrap">
                                        {formatDate(entry.paymentDate)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{entry.payeeNameSnapshot}</span>
                                            <span className="text-xs text-muted-foreground">
                                                ID: {entry.payeeTaxIdSnapshot}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm">{entry.incomeCategorySnapshot}</span>
                                            <span className="text-xs text-blue-600 font-medium">
                                                {entry.rateSnapshot?.toString()}% ({entry.formTypeSnapshot})
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(entry.grossPayableAmount)}
                                    </TableCell>
                                    <TableCell className="text-right text-destructive font-semibold">
                                        {formatCurrency(entry.whtAmount)}
                                    </TableCell>
                                    <TableCell>
                                        {entry.certificate ? (
                                            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50/50">
                                                <FileCheck className="w-3 h-3 mr-1" />
                                                {entry.certificate.certNumber}
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="opacity-60">รอนำส่ง</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right px-2">
                                        {entry.certificate ? (
                                            <PdfPrintTrigger
                                                type="WHT_CERTIFICATE"
                                                documentData={{
                                                    shop,
                                                    payee: { name: entry.payeeNameSnapshot, taxId: entry.payeeTaxIdSnapshot },
                                                    entry,
                                                    certificate: entry.certificate
                                                }}
                                                fileName={`WHT-${entry.certificate.certNumber}.pdf`}
                                                label="พิมพ์ 50 ทวิ"
                                                variant="outline"
                                                className="h-8 text-xs"
                                            />
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                                                onClick={() => handleIssue(entry.id)}
                                                disabled={isPending}
                                            >
                                                {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Printer className="w-3 h-3 mr-1" />}
                                                ออกใบรับรอง
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
