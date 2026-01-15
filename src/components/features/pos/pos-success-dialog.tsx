'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface POSSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber?: string;
}

/**
 * POS Success Dialog - Shows after successful sale completion
 */
export function POSSuccessDialog({
  isOpen,
  onClose,
  invoiceNumber,
}: POSSuccessDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold text-center">
              บันทึกการขายสำเร็จ
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {invoiceNumber && (
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">เลขที่ใบเสร็จ</p>
              <p className="text-xl font-bold text-primary">{invoiceNumber}</p>
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={onClose}
          >
            ตกลง
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
