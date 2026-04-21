'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileCheck, CreditCard, X } from 'lucide-react';
import { postInvoice, markInvoicePaid, cancelInvoice } from '@/actions/invoices';

interface InvoiceActionsProps {
    invoiceId: string;
    status: string;
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handlePost = () => {
        if (!confirm('บันทึกใบแจ้งหนี้นี้อย่างเป็นทางการ? จะไม่สามารถแก้ไขได้อีก')) return;
        startTransition(async () => {
            const result = await postInvoice(invoiceId);
            if (result.success) { toast.success(result.message); router.refresh(); }
            else toast.error(result.message);
        });
    };

    const handlePaid = () => {
        if (!confirm('ยืนยันการรับชำระเงินครบจำนวน?')) return;
        startTransition(async () => {
            const result = await markInvoicePaid(invoiceId);
            if (result.success) { toast.success(result.message); router.refresh(); }
            else toast.error(result.message);
        });
    };

    const handleCancel = () => {
        if (!confirm('ยืนยันการยกเลิกใบแจ้งหนี้?')) return;
        startTransition(async () => {
            const result = await cancelInvoice(invoiceId);
            if (result.success) { toast.success(result.message); router.refresh(); }
            else toast.error(result.message);
        });
    };

    return (
        <div className="flex gap-2">
            {status === 'DRAFT' && (
                <>
                    <Button size="sm" onClick={handlePost} disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
                        <FileCheck className="mr-2 h-4 w-4" /> บันทึกอย่างเป็นทางการ
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                        <X className="mr-2 h-4 w-4" /> ยกเลิก
                    </Button>
                </>
            )}
            {status === 'POSTED' && (
                <>
                    <Button size="sm" onClick={handlePaid} disabled={isPending} className="bg-green-600 hover:bg-green-700">
                        <CreditCard className="mr-2 h-4 w-4" /> รับชำระเงิน
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                        <X className="mr-2 h-4 w-4" /> ยกเลิก
                    </Button>
                </>
            )}
        </div>
    );
}
