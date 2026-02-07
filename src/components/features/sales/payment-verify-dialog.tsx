'use client';

import { useState, useTransition } from 'react';
import { CheckCircle, XCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { verifyPayment } from '@/actions/sales';
import { useRouter } from 'next/navigation';

interface PaymentVerifyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  saleId: string;
  currentStatus: string;
  invoiceNumber: string;
}

export function PaymentVerifyDialog({
  isOpen,
  onClose,
  saleId,
  currentStatus,
  invoiceNumber,
}: PaymentVerifyDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleAction = (action: 'VERIFIED' | 'REJECTED') => {
    setError('');

    if (action === 'REJECTED' && !note.trim()) {
      setError('กรุณาระบุเหตุผลที่ปฏิเสธ');
      return;
    }

    startTransition(async () => {
      const result = await verifyPayment(saleId, action, note || undefined);
      if (result.success) {
        onClose();
        setNote('');
        router.refresh();
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  const handleClose = () => {
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Shield className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <DialogTitle>ตรวจสอบการชำระเงิน</DialogTitle>
              <DialogDescription className="mt-1">
                บิล {invoiceNumber} — สถานะ: {currentStatus}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="payment-note">
              หมายเหตุ {currentStatus !== 'VERIFIED' && <span className="text-muted-foreground">(บังคับกรอกสำหรับปฏิเสธ)</span>}
            </Label>
            <Textarea
              id="payment-note"
              placeholder="ระบุหมายเหตุ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAction('REJECTED')}
            disabled={isPending}
          >
            <XCircle className="h-4 w-4 mr-1" />
            {isPending ? 'กำลัง...' : 'ปฏิเสธ'}
          </Button>
          <Button
            onClick={() => handleAction('VERIFIED')}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            {isPending ? 'กำลัง...' : 'ยืนยัน'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
