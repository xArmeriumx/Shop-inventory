'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { Send } from 'lucide-react';
import { submitOrderRequest } from '@/actions/sales/order-requests.actions';
import { OrderRequestStatus } from '@/types/domain';

interface OrderRequestActionsProps {
    requestId: string;
    status: string;
}

export function OrderRequestActions({ requestId, status }: OrderRequestActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        if (!confirm('คุณต้องการส่งคำขอซื้อนี้เพื่อขออนุมัติใช่หรือไม่?')) return;

        startTransition(async () => {
            await runActionWithToast(submitOrderRequest(requestId), {
                successMessage: 'ส่งคำขอซื้อเพื่อขออนุมัติเรียบร้อยแล้ว',
                onSuccess: () => {
                    setTimeout(() => {
                        router.refresh();
                    }, 100);
                }
            });
        });
    };

    // Show if Draft OR if Submitted but stuck (backend handles the check)
    if (status !== OrderRequestStatus.DRAFT && status !== OrderRequestStatus.SUBMITTED) return null;

    return (
        <Button
            variant="default"
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
            onClick={handleSubmit}
            disabled={isPending}
        >
            <Send className="mr-2 h-4 w-4" /> ส่งขออนุมัติ
        </Button>
    );
}
