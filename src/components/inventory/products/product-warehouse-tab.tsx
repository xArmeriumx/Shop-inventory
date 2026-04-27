'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Warehouse, PackageSearch, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getProductStockBreakdownAction, getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { runActionWithToast } from '@/lib/mutation-utils';
import { cn } from '@/lib/utils';
import { StockTransferDialog } from './stock-transfer-dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface ProductWarehouseTabProps {
    productId: string;
}

export function ProductWarehouseTab({ productId }: ProductWarehouseTabProps) {
    const router = useRouter();
    const [rows, setRows] = useState<any[]>([]);
    const [allWarehouses, setAllWarehouses] = useState<any[]>([]);
    const [isPending, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [breakdownRes, warehousesRes] = await Promise.all([
                getProductStockBreakdownAction(productId),
                getWarehousesAction()
            ]);

            if (breakdownRes.success && Array.isArray(breakdownRes.data)) {
                setRows(breakdownRes.data);
            }
            if (warehousesRes.success && Array.isArray(warehousesRes.data)) {
                setAllWarehouses(warehousesRes.data);
            }
        });
    }, [productId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isPending && rows.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">กำลังโหลดข้อมูลคลัง...</span>
            </div>
        );
    }

    const totalOnHand = rows.reduce((sum, r) => sum + Number(r.quantity), 0);

    return (
        <div className="space-y-6 pb-10">
            <Card className="border-none shadow-none bg-transparent">
                <CardHeader className="px-0">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Warehouse className="h-5 w-5 text-sky-600" />
                            <CardTitle className="text-lg">สต็อกตามคลังสินค้า</CardTitle>
                        </div>
                        {rows.length > 0 && allWarehouses.length > 1 && (
                            <StockTransferDialog
                                productId={productId}
                                productName="สินค้าชิ้นนี้"
                                warehouses={allWarehouses}
                                stockRows={rows}
                                onSuccess={fetchData}
                            />
                        )}
                    </div>
                    <CardDescription>
                        คงเหลือในแต่ละคลังสินค้า — ตามหลัก SSOT: ยอดรวมทั้งหมด = {totalOnHand} หน่วย
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-0">
                    {rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <PackageSearch className="h-10 w-10 opacity-20" />
                            <p className="text-sm">ยังไม่มีข้อมูลสต็อกตามคลัง</p>
                            <p className="text-xs opacity-60">ข้อมูลจะปรากฏหลังมีการเคลื่อนไหวสต็อกครั้งแรก</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border bg-background overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>คลังสินค้า</TableHead>
                                        <TableHead>รหัสคลัง</TableHead>
                                        <TableHead className="text-right">คงเหลือในคลัง</TableHead>
                                        <TableHead className="text-right">จองแล้ว</TableHead>
                                        <TableHead className="text-right">อัปเดตล่าสุด</TableHead>
                                        <TableHead className="text-center">สถานะคลัง</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => {
                                        const qty = Number(row.quantity);
                                        const isDefault = row.warehouse?.isDefault ?? false;
                                        const isActive = row.warehouse?.isActive ?? true;
                                        const isLow = qty <= 0;

                                        return (
                                            <TableRow
                                                key={row.id}
                                                className={cn(
                                                    'transition-colors',
                                                    isLow && 'bg-red-50/40',
                                                    !isActive && 'opacity-50'
                                                )}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Warehouse className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div>
                                                            <p className="font-semibold text-sm">{row.warehouse?.name ?? '—'}</p>
                                                            {row.warehouse?.address && (
                                                                <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                                                                    {row.warehouse.address}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {isDefault && (
                                                            <Badge className="text-[10px] h-4 px-1.5 bg-sky-100 text-sky-700 border-sky-200 shrink-0">
                                                                หลัก
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs text-muted-foreground">
                                                        {row.warehouse?.code ?? '—'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className={cn(
                                                        'font-mono font-bold text-base',
                                                        isLow ? 'text-red-600' : 'text-emerald-600'
                                                    )}>
                                                        {qty.toLocaleString()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="text-muted-foreground text-sm font-mono">
                                                        {Number(row.reservedStock || 0).toLocaleString()}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="text-xs text-muted-foreground">
                                                        {row.updatedAt
                                                            ? format(new Date(row.updatedAt), 'dd MMM yy HH:mm', { locale: th })
                                                            : '—'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isActive ? (
                                                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            ใช้งาน
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">
                                                            ปิดใช้งาน
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Summary Footer */}
                            <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    รวมทั้งหมด {rows.length} คลัง
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-muted-foreground text-xs">
                                        คงเหลือในคลังรวม:
                                    </span>
                                    <span className="font-mono font-bold text-base text-sky-700">
                                        {totalOnHand.toLocaleString()}
                                    </span>
                                    <span className="text-muted-foreground text-xs">หน่วย</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
