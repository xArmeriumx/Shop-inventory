'use client';

import { useState } from 'react';
import { CheckCircle2, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { POSReceiptModal } from '@/components/features/receipts/pos-receipt-modal';

interface POSSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNumber?: string;
  saleId?: string;
  amountReceived?: number;
  change?: number;
}

/**
 * POS Success Dialog - Shows after successful sale completion
 * Now with integrated thermal receipt printing
 */
export function POSSuccessDialog({
  isOpen,
  onClose,
  invoiceNumber,
  saleId,
  amountReceived,
  change,
}: POSSuccessDialogProps) {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const handlePrintReceipt = () => {
    if (saleId) {
      setIsReceiptModalOpen(true);
    }
  };

  return (
    <>
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

            {/* Payment Summary */}
            {amountReceived !== undefined && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">รับเงิน</span>
                  <span className="font-medium">฿{amountReceived.toLocaleString()}</span>
                </div>
                {change !== undefined && change > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">เงินทอน</span>
                    <span className="font-bold text-green-600">฿{change.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handlePrintReceipt}
                disabled={!saleId}
              >
                <Printer className="mr-2 h-4 w-4" />
                พิมพ์ใบเสร็จ
              </Button>
              {saleId && (
                <Button variant="outline" asChild>
                  <Link href={`/sales/${saleId}`} target="_blank">
                    <FileText className="mr-2 h-4 w-4" />
                    ดูใบเสร็จ A4
                  </Link>
                </Button>
              )}
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={onClose}
            >
              ขายรายการต่อไป
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thermal Receipt Modal */}
      {saleId && (
        <POSReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          saleId={saleId}
          amountReceived={amountReceived}
          change={change}
        />
      )}
    </>
  );
}


