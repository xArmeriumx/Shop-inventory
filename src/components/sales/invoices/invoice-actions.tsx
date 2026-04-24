'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileCheck, CreditCard, X, AlertTriangle } from 'lucide-react';
import { postInvoice, markInvoicePaid, cancelInvoice } from '@/actions/sales/invoices.actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InvoiceActionsProps {
    invoiceId: string;
    status: string;
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [confirmAction, setConfirmAction] = useState<{ type: 'POST' | 'PAID' | 'CANCEL', open: boolean }>({
        type: 'POST',
        open: false
    });

    const executeAction = async () => {
        setConfirmAction(prev => ({ ...prev, open: false }));

        startTransition(async () => {
            let result;
            if (confirmAction.type === 'POST') result = await postInvoice(invoiceId);
            else if (confirmAction.type === 'PAID') result = await markInvoicePaid(invoiceId);
            else if (confirmAction.type === 'CANCEL') result = await cancelInvoice(invoiceId);

            if (result?.success) {
                toast.success(result.message);
                router.refresh();
            } else if (result) {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="flex gap-2">
            {status === 'DRAFT' && (
                <>
                    <Button
                        size="sm"
                        onClick={() => setConfirmAction({ type: 'POST', open: true })}
                        disabled={isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <FileCheck className="mr-2 h-4 w-4" /> บันทึกอย่างเป็นทางการ
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAction({ type: 'CANCEL', open: true })}
                        disabled={isPending}
                    >
                        <X className="mr-2 h-4 w-4" /> ยกเลิก
                    </Button>
                </>
            )}
            {status === 'POSTED' && (
                <>
                    <Button
                        size="sm"
                        onClick={() => setConfirmAction({ type: 'PAID', open: true })}
                        disabled={isPending}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <CreditCard className="mr-2 h-4 w-4" /> รับชำระเงิน
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAction({ type: 'CANCEL', open: true })}
                        disabled={isPending}
                    >
                        <X className="mr-2 h-4 w-4" /> ยกเลิก
                    </Button>
                </>
            )}

            <AlertDialog open={confirmAction.open} onOpenChange={(open) => setConfirmAction(prev => ({ ...prev, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className={`h-5 w-5 ${confirmAction.type === 'CANCEL' ? 'text-red-500' : 'text-amber-500'}`} />
                            {confirmAction.type === 'POST' && 'ยืนยันการบันทึกใบแจ้งหนี้'}
                            {confirmAction.type === 'PAID' && 'ยืนยันการรับชำระเงิน'}
                            {confirmAction.type === 'CANCEL' && 'ยืนยันการยกเลิกเอกสาร'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmAction.type === 'POST' && 'เมื่อบันทึกแล้ว ข้อมูลภาษีและยอดเงินจะไม่สามารถแก้ไขได้อีก คุณต้องการดำเนินการต่อหรือไม่?'}
                            {confirmAction.type === 'PAID' && 'ยืนยันว่าได้รับชำระเงินตามยอดสุทธิของใบแจ้งหนี้นี้ครบถ้วนแล้ว?'}
                            {confirmAction.type === 'CANCEL' && 'การยกเลิกจะทำการยกเลิกรายการทางบัญชีและภาษีที่เกี่ยวข้องด้วย คุณแน่ใจหรือไม่?'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeAction}
                            className={confirmAction.type === 'CANCEL' ? 'bg-red-600 hover:bg-red-700' : ''}
                        >
                            ยืนยัน
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
