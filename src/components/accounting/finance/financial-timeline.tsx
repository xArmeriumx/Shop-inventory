'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
    CheckCircle2,
    Clock,
    XCircle,
    MoreVertical,
    Trash2,
    CornerDownRight,
    Receipt
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import {
    PAYMENT_METHODS
} from '@/constants/erp/accounting.constants';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { voidPaymentAction } from '@/actions/accounting/payments.actions';
import { toast } from 'sonner';
import { Guard } from '@/components/core/auth/guard';
import { Permission } from '@prisma/client';

interface Payment {
    id: string;
    amount: number;
    paymentMethodCode: string;
    paymentDate: Date;
    status: string;
    referenceId?: string;
    note?: string;
}

interface FinancialTimelineProps {
    payments: any[];
    totalAmount: number;
    paidAmount: number;
    residualAmount: number;
    saleId?: string;
    invoiceId?: string;
}

export function FinancialTimeline({
    payments,
    totalAmount,
    paidAmount,
    residualAmount,
    saleId,
    invoiceId
}: FinancialTimelineProps) {
    const handleVoid = async (paymentId: string) => {
        if (!confirm('ยืนยันการยกเลิกรายการชำระเงินนี้?')) return;

        try {
            const result = await voidPaymentAction(paymentId, { saleId, invoiceId });
            if (result.success) {
                toast.success('ยกเลิกรายการชำระเงินสำเร็จ');
            } else {
                toast.error(result.message || 'เกิดข้อผิดพลาดในการยกเลิกรายการ');
            }
        } catch (error) {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        }
    };

    return (
        <div className="space-y-6">
            {/* Payment Summary Progress */}
            <div className="bg-muted/30 p-4 rounded-xl border border-dashed flex flex-col gap-3">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">สถานะการชำระ</p>
                        <p className="text-2xl font-black text-primary">
                            {formatCurrency(paidAmount)}
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                จาก {formatCurrency(totalAmount)}
                            </span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase font-bold mb-1">คงเหลือ</p>
                        <p className={`text-lg font-bold ${residualAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {formatCurrency(residualAmount)}
                        </p>
                    </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(100, (paidAmount / totalAmount) * 100)}%` }}
                    />
                </div>
            </div>

            {/* Timeline Items */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-muted">
                {payments.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">ยังไม่มีประวัติการชำระเงิน</p>
                    </div>
                ) : (
                    payments.map((payment) => {
                        const method = (PAYMENT_METHODS as any)[payment.paymentMethodCode] || { label: payment.paymentMethodCode };
                        const isVoided = payment.status === 'VOIDED';

                        return (
                            <div key={payment.id} className="relative">
                                {/* Dot */}
                                <div className={`absolute -left-[31px] mt-1 h-5 w-5 rounded-full border-4 border-background flex items-center justify-center ${isVoided ? 'bg-muted' : 'bg-primary'}`}>
                                    {isVoided ? <XCircle className="h-2 w-2 text-white" /> : <CheckCircle2 className="h-2 w-2 text-white" />}
                                </div>

                                <div className={`group p-4 rounded-xl border bg-card transition-all hover:shadow-md ${isVoided ? 'opacity-60 bg-muted/10 grayscale' : ''}`}>
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-base">{formatCurrency(payment.amount)}</p>
                                                <Badge variant={isVoided ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-1.5 font-bold">
                                                    {method.label}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                <Receipt className="h-3 w-3" />
                                                ชำระเมื่อ {format(new Date(payment.paymentDate), 'd MMM yyyy HH:mm', { locale: th })}
                                            </p>
                                        </div>

                                        {!isVoided && (
                                            <Guard permission={'PAYMENT_VOID' as any}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleVoid(payment.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            ยกเลิกรายการนี้
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </Guard>
                                        )}
                                    </div>

                                    {(payment.referenceId || payment.note) && (
                                        <div className="mt-3 pt-3 border-t border-dashed flex flex-col gap-1 text-xs">
                                            {payment.referenceId && (
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <CornerDownRight className="h-3 w-3" />
                                                    <span className="font-semibold text-foreground">อ้างอิง:</span> {payment.referenceId}
                                                </div>
                                            )}
                                            {payment.note && (
                                                <div className="flex items-center gap-2 text-muted-foreground italic">
                                                    <CornerDownRight className="h-3 w-3" />
                                                    &quot;{payment.note}&quot;
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
