'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { CheckCircle, XCircle } from 'lucide-react';
import { confirmQuotation, cancelQuotation } from '@/actions/sales/quotations.actions';
import { QuotationStatus } from '@/types/domain';

interface QuotationActionsProps {
    quotationId: string;
    status: string;
}

export function QuotationActions({ quotationId, status }: QuotationActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleConfirm = () => {
        if (!confirm('คุณต้องการยืนยันใบเสนอราคานี้และสร้างรายการขายใช่หรือไม่?')) return;

        startTransition(async () => {
            await runActionWithToast(confirmQuotation(quotationId), {
                successMessage: 'ยืนยันใบเสนอราคาสำเร็จ',
                onSuccess: () => router.refresh()
            });
        });
    };

    const handleCancel = () => {
        if (!confirm('คุณต้องการยกเลิกใบเสนอราคานี้ใช่หรือไม่?')) return;

        startTransition(async () => {
            await runActionWithToast(cancelQuotation(quotationId), {
                successMessage: 'ยกเลิกใบเสนอราคาสำเร็จ',
                onSuccess: () => router.refresh()
            });
        });
    };

    if (status !== QuotationStatus.DRAFT && status !== QuotationStatus.SENT) return null;

    return (
        <div className="flex gap-2">
            <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={isPending}
            >
                <CheckCircle className="mr-2 h-4 w-4" /> ยืนยัน / สร้าง SO
            </Button>
            <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
            >
                <XCircle className="mr-2 h-4 w-4" /> ยกเลิก
            </Button>
        </div>
    );
}
