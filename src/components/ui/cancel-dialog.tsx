'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// Default Cancel Reasons
const DEFAULT_CANCEL_REASONS: Record<string, string> = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  CUSTOMER_REQUEST: 'ลูกค้าขอยกเลิก',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
};

interface CancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonDetail?: string) => Promise<void>;
  title: string;
  description: string;
  stockChangePreview?: string;
  isLoading?: boolean;
  reasons?: Record<string, string>; // Custom reasons for different contexts
}

/**
 * Cancel Dialog - Used for canceling sales/purchases with mandatory reason
 * ยกเลิกรายการ พร้อมเหตุผล (บังคับกรอก)
 */
export function CancelDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  stockChangePreview,
  isLoading = false,
  reasons = DEFAULT_CANCEL_REASONS,
}: CancelDialogProps) {
  const [reasonCode, setReasonCode] = useState<string>('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setError('');

    // Validate
    if (!reasonCode) {
      setError('กรุณาเลือกเหตุผลในการยกเลิก');
      return;
    }

    if (reasonCode === 'OTHER' && !reasonDetail.trim()) {
      setError('กรุณากรอกรายละเอียดเหตุผล');
      return;
    }

    await onConfirm(reasonCode, reasonDetail || undefined);
  };

  const handleClose = () => {
    setReasonCode('');
    setReasonDetail('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stock Change Preview */}
          {stockChangePreview && (
            <div className="bg-muted rounded-lg p-3 text-sm">
              <span className="font-medium">การเปลี่ยนแปลงสต็อก:</span>{' '}
              <span className="text-primary">{stockChangePreview}</span>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              เหตุผลในการยกเลิก <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reasonCode}
              onValueChange={setReasonCode}
            >
              <SelectTrigger id="cancel-reason">
                <SelectValue placeholder="เลือกเหตุผล" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reasons).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detail (for OTHER) */}
          {reasonCode === 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="cancel-detail">
                รายละเอียด <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancel-detail"
                placeholder="กรุณาระบุเหตุผล..."
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            ไม่ใช่
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'กำลังดำเนินการ...' : 'ยืนยันยกเลิก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export reason constants for reuse
export const SALE_CANCEL_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  CUSTOMER_REQUEST: 'ลูกค้าขอยกเลิก',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
};

export const PURCHASE_VOID_REASONS = {
  WRONG_ENTRY: 'บันทึกผิดพลาด',
  SUPPLIER_ISSUE: 'ปัญหาจากผู้จำหน่าย',
  DAMAGED: 'สินค้าชำรุด',
  OTHER: 'อื่นๆ',
};
