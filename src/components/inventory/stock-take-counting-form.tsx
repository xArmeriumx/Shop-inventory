'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { STOCK_TAKE_STATUS_CONFIG } from '@/constants/erp/inventory.constants';
import {
    updateStockTakeItemAction,
    submitStockTakeAction,
    completeStockTakeAction,
    cancelStockTakeAction
} from '@/actions/inventory/stock-take.actions';
import { toast } from 'sonner';
import {
    Save,
    CheckCircle2,
    AlertTriangle,
    History,
    ArrowRightCircle,
    XCircle,
    AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface StockTakeCountingFormProps {
    session: any;
}

export function StockTakeCountingForm({ session }: StockTakeCountingFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [counts, setCounts] = useState<Record<string, number>>(
        Object.fromEntries(session.items.map((i: any) => [i.productId, i.countedQty ?? 0]))
    );

    const isDraft = session.status === 'DRAFT';
    const isSubmitted = session.status === 'SUBMITTED';
    const isCompleted = session.status === 'COMPLETED';

    const handleCountChange = (productId: string, val: string) => {
        const num = parseInt(val) || 0;
        setCounts(prev => ({ ...prev, [productId]: num }));
    };

    const handleSaveItem = async (productId: string) => {
        try {
            await updateStockTakeItemAction(session.id, productId, counts[productId]);
            toast.success('บันทึกจำนวนแล้ว');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleSubmit = () => {
        startTransition(async () => {
            try {
                await submitStockTakeAction(session.id);
                toast.success('ส่งรอยืนยันการตรวจนับแล้ว');
                router.refresh();
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const handleComplete = () => {
        startTransition(async () => {
            try {
                await completeStockTakeAction(session.id);
                toast.success('อนุมัติและปรับปรุงสต็อกสำเร็จ');
                router.push('/inventory/stock-take');
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    const handleCancel = () => {
        const reason = prompt('ระบุเหตุผลที่ยกเลิก:');
        if (!reason) return;

        startTransition(async () => {
            try {
                await cancelStockTakeAction(session.id, reason);
                toast.success('ยกเลิกรายการตรวจนับแล้ว');
                router.refresh();
            } catch (error: any) {
                toast.error(error.message);
            }
        });
    };

    return (
        <div className="grid gap-6">
            {/* Session Header Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardDescription>สถานะปัจจุบัน</CardDescription>
                        <CardTitle className="flex items-center gap-2">
                            <StatusBadge
                                status={session.status}
                                config={STOCK_TAKE_STATUS_CONFIG}
                            />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            {isDraft && "กำลังนับสินค้า คุณสามารถแก้ไขจำนวนได้"}
                            {isSubmitted && "รอผู้จัดการตรวจสอบและอนุมัติยอด"}
                            {isCompleted && "รายการเรียบร้อยและปรับสต็อกแล้ว"}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>ผู้สร้างรายการ</CardDescription>
                        <CardTitle className="text-lg">{session.creator?.user?.name ?? 'Unknown'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            เมื่อ {format(session.createdAt, 'd MMM yyyy HH:mm', { locale: th })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>นโยบายการนับ</CardDescription>
                        <CardTitle className="text-lg">Freeze-session</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground">
                            เทียบยอดกับสต็อกที่มี ณ เวลาเปิด Session
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Items Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>รายการสินค้าที่ตรวจนับ</CardTitle>
                        <CardDescription>ระบุจำนวนที่นับได้จริงเพื่อคำนวณผลต่าง</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDraft && (
                            <>
                                <Button onClick={handleCancel} variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5">
                                    ยกเลิก
                                </Button>
                                <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
                                    <ArrowRightCircle className="w-4 h-4" />
                                    ส่งรอยืนยัน
                                </Button>
                            </>
                        )}
                        {isSubmitted && (
                            <>
                                <Button onClick={handleCancel} variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5">
                                    ไม่อนุมัติ
                                </Button>
                                <Button onClick={handleComplete} disabled={isPending} className="gap-2 bg-green-600 hover:bg-green-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                    อนุมัติยอดและปรับสต็อก
                                </Button>
                            </>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[300px]">สินค้า</TableHead>
                                <TableHead className="text-right">สต็อกในระบบ (A)</TableHead>
                                <TableHead className="text-right w-[150px]">นับได้จริง (B)</TableHead>
                                <TableHead className="text-right">ผลต่าง (B-A)</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {session.items.map((item: any) => {
                                const localCount = counts[item.productId];
                                const diff = isDraft ? (localCount - item.systemOnHandQty) : item.differenceQty;

                                return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <div className="font-medium">{item.product.name}</div>
                                            <div className="text-xs text-muted-foreground">SKU: {item.product.sku || '-'}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-lg">
                                            {item.systemOnHandQty}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                value={localCount}
                                                onChange={(e) => handleCountChange(item.productId, e.target.value)}
                                                disabled={!isDraft || isPending}
                                                className="text-right font-mono text-lg h-10"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className={`font-mono text-lg ${diff > 0 ? 'text-green-600' :
                                                diff < 0 ? 'text-red-600' :
                                                    'text-muted-foreground'
                                                }`}>
                                                {diff > 0 ? '+' : ''}{diff}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isDraft && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleSaveItem(item.productId)}
                                                >
                                                    <Save className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Audit History Small Footer */}
            {(isSubmitted || isCompleted) && (
                <div className="bg-muted/30 p-4 rounded-lg space-y-2 border border-dashed">
                    <div className="text-sm font-medium flex items-center gap-2 mb-2">
                        <History className="w-4 h-4 text-primary" />
                        Audit Trail
                    </div>
                    {session.submittedAt && (
                        <p className="text-xs text-muted-foreground">
                            • ส่งรอยืนยันโดย <span className="font-medium">{session.submitter?.user?.name ?? 'Unknown'}</span> เมื่อ {format(session.submittedAt, 'd MMM yyyy HH:mm', { locale: th })}
                        </p>
                    )}
                    {session.completedAt && (
                        <p className="text-xs text-muted-foreground">
                            • อนุมัติโดย <span className="font-medium">{session.completer?.user?.name ?? 'Unknown'}</span> เมื่อ {format(session.completedAt, 'd MMM yyyy HH:mm', { locale: th })} (ปรับสต็อกสำเร็จ)
                        </p>
                    )}
                    {session.cancelledAt && (
                        <p className="text-xs text-muted-foreground text-destructive">
                            • ยกเลิกโดย <span className="font-medium">{session.canceller?.user?.name ?? 'Unknown'}</span> เมื่อ {format(session.cancelledAt, 'd MMM yyyy HH:mm', { locale: th })}
                            <br /> เหตุผล: {session.cancelReason}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
