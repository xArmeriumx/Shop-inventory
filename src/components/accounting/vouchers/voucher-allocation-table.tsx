'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getUnpaidDocumentsAction } from '@/actions/accounting/voucher.actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2, CheckCircle2, ChevronRight, Calculator } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface VoucherAllocationTableProps {
    type: 'RECEIPT' | 'PAYMENT';
    partnerId: string;
    onAllocationChange: (allocations: any[]) => void;
    totalAmountToAllocate: number;
}

export const VoucherAllocationTable: React.FC<VoucherAllocationTableProps> = ({
    type,
    partnerId,
    onAllocationChange,
    totalAmountToAllocate,
}) => {
    const [isPending, startTransition] = useTransition();
    const [docs, setDocs] = useState<any[]>([]);
    const [allocations, setAllocations] = useState<Record<string, number>>({});

    // Fetch unpaid docs when partnerId changes
    useEffect(() => {
        if (!partnerId) {
            setDocs([]);
            setAllocations({});
            return;
        }

        startTransition(async () => {
            const res = await getUnpaidDocumentsAction({ type, partnerId });
            if (res.success && res.data) {
                setDocs(res.data);
                setAllocations({});
            }
        });
    }, [partnerId, type]);

    // Update parent whenever allocations change
    useEffect(() => {
        const allocList = Object.entries(allocations)
            .filter(([_, amount]) => amount > 0)
            .map(([id, amount]) => ({
                [type === 'RECEIPT' ? 'invoiceId' : 'purchaseId']: id,
                amount,
            }));
        onAllocationChange(allocList);
    }, [allocations, onAllocationChange, type]);

    const handleAmountChange = (id: string, value: string, residual: number) => {
        const numValue = parseFloat(value) || 0;
        const clampedValue = Math.min(Math.max(0, numValue), residual);

        setAllocations(prev => ({
            ...prev,
            [id]: clampedValue,
        }));
    };

    const handlePayFull = (id: string, residual: number) => {
        // Calculate remaining budget from totalAmountToAllocate
        const currentTotal = Object.entries(allocations).reduce((sum, [key, val]) => sum + (key === id ? 0 : val), 0);
        const budget = Math.max(0, totalAmountToAllocate - currentTotal);
        const amountToSet = Math.min(residual, budget);

        setAllocations(prev => ({
            ...prev,
            [id]: amountToSet,
        }));
    };

    const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
    const remainingToAllocate = totalAmountToAllocate - totalAllocated;

    if (!partnerId) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/30 text-muted-foreground">
                <ChevronRight className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">กรุณาเลือก{type === 'RECEIPT' ? 'ลูกค้า' : 'ผู้จำหน่าย'}เพื่อแสดงรายการค้างชำระ</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    รายการจัดสรรยอด (Allocations)
                </h3>
                <div className="flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">ยอดจัดสรรแล้ว:</span>
                        <span className={cn(
                            totalAllocated > totalAmountToAllocate ? "text-destructive" : "text-primary font-bold"
                        )}>
                            {formatCurrency(totalAllocated)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">คงเหลือ:</span>
                        <span className={cn(
                            remainingToAllocate !== 0 ? "text-warning" : "text-success font-bold"
                        )}>
                            {formatCurrency(remainingToAllocate)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[120px]">เลขที่เอกสาร</TableHead>
                            <TableHead className="w-[100px]">วันที่</TableHead>
                            <TableHead className="text-right">ยอดทั้งหมด</TableHead>
                            <TableHead className="text-right">ยอดคงค้าง</TableHead>
                            <TableHead className="text-right w-[180px]">ระบุยอดตัดชำระ</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isPending ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : docs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    ไม่พบรายการค้างชำระ
                                </TableCell>
                            </TableRow>
                        ) : (
                            docs.map((doc) => (
                                <TableRow key={doc.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-medium text-xs">{doc.docNo}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{formatDate(doc.date)}</TableCell>
                                    <TableCell className="text-right text-xs">{formatCurrency(doc.totalAmount)}</TableCell>
                                    <TableCell className="text-right text-xs font-bold text-warning">
                                        {formatCurrency(doc.residualAmount)}
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 text-right text-sm font-semibold"
                                            value={allocations[doc.id] || ''}
                                            onChange={(e) => handleAmountChange(doc.id, e.target.value, doc.residualAmount)}
                                            placeholder="0.00"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 w-full text-[10px] text-primary hover:bg-primary/10"
                                            onClick={() => handlePayFull(doc.id, doc.residualAmount)}
                                            disabled={remainingToAllocate <= 0 && !allocations[doc.id]}
                                        >
                                            จ่ายเต็ม
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {remainingToAllocate < 0 && (
                <p className="text-[10px] text-destructive text-right mt-1 font-medium">
                    * ยอดรวมการจัดสรรเกินยอดรับชำระทั้งหมด
                </p>
            )}
        </div>
    );
};
