'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle, Search, Trash2 } from 'lucide-react';
import { validateDelivery, checkDOAvailability, cancelDeliveryOrder } from '@/actions/sales/deliveries.actions';
import { runActionWithToast } from '@/lib/mutation-utils';

interface DeliveryActionsProps {
    deliveryId: string;
    status: string;
}

export function DeliveryActions({ deliveryId, status }: DeliveryActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleDeliver = async () => {
        if (!confirm('คุณต้องการยืนยันการส่งสินค้าและตัดสต็อกใช่หรือไม่? ระบบจะสร้างใบแจ้งหนี้ให้อัตโนมัติ')) return;

        await runActionWithToast(
            validateDelivery(deliveryId),
            {
                loadingMessage: 'กำลังยืนยันการส่งสินค้า...',
                successMessage: 'ส่งสินค้าสำเร็จ สต็อกถูกตัดและสร้างใบแจ้งหนี้แล้ว',
                onSuccess: () => router.refresh()
            }
        );
    };

    const handleCheckStock = async () => {
        await runActionWithToast(
            checkDOAvailability(deliveryId),
            {
                loadingMessage: 'กำลังตรวจสอบสต็อกล่าสุด...',
                onSuccess: (res) => {
                    if (res.available) {
                        router.refresh();
                    }
                }
            }
        );
    };

    const handleCancel = async () => {
        if (!confirm('คุณต้องการยกเลิกใบส่งของนี้ใช่หรือไม่?')) return;

        await runActionWithToast(
            cancelDeliveryOrder(deliveryId),
            {
                loadingMessage: 'กำลังยกเลิกใบส่งของ...',
                successMessage: 'ยกเลิกใบส่งของสำเร็จ',
                onSuccess: () => router.refresh()
            }
        );
    };

    if (status === 'DELIVERED' || status === 'CANCELLED') return null;

    return (
        <div className="flex gap-2">
            {status === 'WAITING' && (
                <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                    onClick={handleCheckStock}
                    disabled={isPending}
                >
                    <Search className="mr-2 h-4 w-4" /> เช็คสต็อก (Check Stock)
                </Button>
            )}

            {status === 'PROCESSING' && (
                <Button
                    variant="default"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={handleDeliver}
                    disabled={isPending}
                >
                    <CheckCircle className="mr-2 h-4 w-4" /> ยืนยันการส่งสินค้า (Done)
                </Button>
            )}

            <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleCancel}
                disabled={isPending}
            >
                <Trash2 className="mr-2 h-4 w-4" /> ยกเลิก DO
            </Button>
        </div>
    );
}
