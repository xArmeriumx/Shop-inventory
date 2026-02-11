'use client';

import { Shield } from 'lucide-react';
import { PaymentStatusBadge } from './payment-status-badge';

interface PaymentSectionProps {
  saleId: string;
  invoiceNumber: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentProof?: string | null;
  paymentNote?: string | null;
  paymentVerifiedAt?: Date | string | null;
}

export function PaymentSection({
  paymentStatus,
  paymentProof,
  paymentNote,
  paymentVerifiedAt,
}: PaymentSectionProps) {
  return (
    <div className="mt-4 border-t pt-4 print:hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">สถานะการชำระเงิน</span>
        </div>
        <PaymentStatusBadge status={paymentStatus} />
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
    </div>
  );
}
