'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, Truck } from 'lucide-react';
import { validateDelivery } from '@/actions/deliveries';

interface DeliveryActionsProps {
    deliveryId: string;
    status: string;
}

export function DeliveryActions({ deliveryId, status }: DeliveryActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleDeliver = () => {
        if (!confirm('คุณต้องการยืนยันการส่งสินค้าและตัดสต็อกใช่หรือไม่?')) return;

        startTransition(async () => {
            const result = await validateDelivery(deliveryId);
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    if (status === 'DELIVERED' || status === 'CANCELLED') return null;

    return (
        <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleDeliver}
            disabled={isPending}
        >
            <CheckCircle className="mr-2 h-4 w-4" /> ยืนยันการส่งสินค้า
        </Button>
    );
}
