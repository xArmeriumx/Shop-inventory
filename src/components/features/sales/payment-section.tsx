'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentStatusBadge } from './payment-status-badge';
import { PaymentVerifyDialog } from './payment-verify-dialog';

interface PaymentSectionProps {
  saleId: string;
  invoiceNumber: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentProof?: string | null;
  paymentNote?: string | null;
  paymentVerifiedAt?: Date | string | null;
  canVerify: boolean;
}

export function PaymentSection({
  saleId,
  invoiceNumber,
  paymentStatus,
  paymentMethod,
  paymentProof,
  paymentNote,
  paymentVerifiedAt,
  canVerify,
}: PaymentSectionProps) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className="mt-4 border-t pt-4 print:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">สถานะการชำระเงิน</span>
        </div>
        <div className="flex items-center gap-2">
          <PaymentStatusBadge status={paymentStatus} />
          {canVerify && paymentStatus !== 'VERIFIED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
            >
              ตรวจสอบ
            </Button>
          )}
        </div>
      </div>

      {/* Payment details */}
      {(paymentNote || paymentProof) && (
        <div className="mt-2 text-sm text-muted-foreground space-y-1">
          {paymentNote && (
            <p>หมายเหตุ: {paymentNote}</p>
          )}
          {paymentProof && (
            <div>
              <a
                href={paymentProof}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                ดูหลักฐานการชำระเงิน
              </a>
            </div>
          )}
          {paymentVerifiedAt && (
            <p>ตรวจสอบเมื่อ: {new Date(paymentVerifiedAt).toLocaleString('th-TH')}</p>
          )}
        </div>
      )}

      <PaymentVerifyDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        saleId={saleId}
        currentStatus={paymentStatus}
        invoiceNumber={invoiceNumber}
      />
    </div>
  );
}
