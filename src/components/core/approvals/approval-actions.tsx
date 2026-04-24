'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { approveStep, rejectStep } from '@/actions/core/approvals.actions';
import { Input } from '@/components/ui/input';

interface ApprovalActionsProps {
    documentId: string;
    documentType: string;
    status: string;
}

export function ApprovalActions({ documentId, documentType, status }: ApprovalActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState('');
    const [showReason, setShowReason] = useState(false);

    // Status check — usually SUBMITTED or PENDING_APPROVAL
    if (status !== 'SUBMITTED' && status !== 'PENDING_APPROVAL') return null;

    const handleApprove = () => {
        if (!confirm('คุณต้องการอนุมัติเอกสารนี้ใช่หรือไม่?')) return;

        startTransition(async () => {
            const result = await approveStep(documentId, documentType);
            if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    const handleReject = () => {
        if (!reason && !showReason) {
            setShowReason(true);
            return;
        }
        if (!reason) {
            toast.error('กรุณาระบุเหตุผลที่ปฏิเสธ');
            return;
        }

        startTransition(async () => {
            const result = await rejectStep(documentId, documentType, reason);
            if (result.success) {
                toast.success(result.message);
                setShowReason(false);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    };

    return (
        <div className="flex flex-col gap-2">
            {showReason && (
                <div className="flex gap-2">
                    <Input
                        placeholder="ระบุเหตุผลที่ปฏิเสธ..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-64"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setShowReason(false)}>ยกเลิก</Button>
                </div>
            )}
            <div className="flex gap-2 justify-end">
                <Button
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={isPending}
                >
                    <CheckCircle className="mr-2 h-4 w-4" /> อนุมัติ
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReject}
                    disabled={isPending}
                >
                    <XCircle className="mr-2 h-4 w-4" /> ปฏิเสธ
                </Button>
            </div>
        </div>
    );
}
