'use client';

import { useState } from 'react';
import { CheckCircle, Loader2, CreditCard, Wallet, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { POSCart, POSPaymentMethod } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface POSPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: POSCart;
  onConfirm: (paymentMethod: string) => Promise<void>;
  isProcessing: boolean;
}

const PAYMENT_OPTIONS: { value: POSPaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'CASH', label: 'เงินสด', icon: <Wallet className="h-5 w-5" /> },
  { value: 'TRANSFER', label: 'โอนเงิน', icon: <Smartphone className="h-5 w-5" /> },
  { value: 'CREDIT', label: 'บัตรเครดิต', icon: <CreditCard className="h-5 w-5" /> },
];

/**
 * POS Payment Dialog - Payment method selection and confirmation
 */
export function POSPaymentDialog({
  isOpen,
  onClose,
  cart,
  onConfirm,
  isProcessing,
}: POSPaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<POSPaymentMethod>('CASH');

  const handleConfirm = async () => {
    await onConfirm(selectedMethod);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">ชำระเงิน</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Order Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-muted-foreground">จำนวนสินค้า</span>
              <span className="font-medium">{cart.itemCount} ชิ้น</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-lg">ยอดชำระ</span>
              <span className="font-bold text-2xl text-primary">
                {formatCurrency(cart.totalAmount.toString())}
              </span>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium">เลือกวิธีชำระเงิน</Label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedMethod(option.value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-lg border-2 transition-all min-h-[80px]',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    'touch-manipulation active:scale-[0.97]',
                    selectedMethod === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 active:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-full',
                    selectedMethod === option.value ? 'bg-primary/10 text-primary' : 'bg-muted'
                  )}>
                    {option.icon}
                  </div>
                  <span className={cn(
                    'text-xs sm:text-sm font-medium',
                    selectedMethod === option.value && 'text-primary'
                  )}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  ยืนยันการชำระเงิน
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
