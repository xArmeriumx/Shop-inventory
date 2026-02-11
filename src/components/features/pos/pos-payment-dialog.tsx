'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, CreditCard, Wallet, Smartphone, QrCode, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { POSCart, POSPaymentMethod } from '@/lib/pos/types';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { PromptPayQR } from './promptpay-qr';

interface POSPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: POSCart;
  onConfirm: (paymentMethod: string, amountReceived?: number, change?: number) => Promise<void>;
  isProcessing: boolean;
  promptPayId?: string;
}

const PAYMENT_OPTIONS: { value: POSPaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'CASH', label: 'เงินสด', icon: <Wallet className="h-5 w-5" /> },
  { value: 'TRANSFER', label: 'โอนเงิน', icon: <Smartphone className="h-5 w-5" /> },
  { value: 'CREDIT', label: 'บัตรเครดิต', icon: <CreditCard className="h-5 w-5" /> },
];

// Quick amount buttons for cash
const QUICK_AMOUNTS = [20, 50, 100, 500, 1000];

/**
 * POS Payment Dialog - Payment method selection and confirmation
 * With cash amount input, change calculation, and PromptPay QR
 */
export function POSPaymentDialog({
  isOpen,
  onClose,
  cart,
  onConfirm,
  isProcessing,
  promptPayId,
}: POSPaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<POSPaymentMethod>('CASH');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [change, setChange] = useState<number>(0);

  // Reset on dialog open
  useEffect(() => {
    if (isOpen) {
      setAmountReceived('');
      setChange(0);
    }
  }, [isOpen]);

  // Calculate change when amount changes
  useEffect(() => {
    const received = parseFloat(amountReceived) || 0;
    const changeAmount = received - cart.totalAmount;
    setChange(changeAmount > 0 ? changeAmount : 0);
  }, [amountReceived, cart.totalAmount]);

  const handleQuickAmount = (amount: number) => {
    setAmountReceived(amount.toString());
  };

  const handleExactAmount = () => {
    setAmountReceived(cart.totalAmount.toString());
  };

  const handleConfirm = async () => {
    const received = selectedMethod === 'CASH' ? parseFloat(amountReceived) || cart.totalAmount : undefined;
    const changeAmount = selectedMethod === 'CASH' ? change : undefined;
    await onConfirm(selectedMethod, received, changeAmount);
  };

  const isCashValid = selectedMethod !== 'CASH' || (parseFloat(amountReceived) || 0) >= cart.totalAmount;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">ชำระเงิน</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
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

          {/* Cash Amount Input - Only show for CASH */}
          {selectedMethod === 'CASH' && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-medium">รับเงิน</Label>
              
              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={handleExactAmount}
                  className="text-xs"
                >
                  พอดี
                </Button>
                {QUICK_AMOUNTS.filter(a => a >= cart.totalAmount).slice(0, 4).map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(amount)}
                    className="text-xs"
                  >
                    ฿{amount.toLocaleString()}
                  </Button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">฿</span>
                <Input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder={cart.totalAmount.toString()}
                  className="pl-8 text-lg h-12 text-right font-medium"
                  min={0}
                  step="0.01"
                />
              </div>

              {/* Change Display */}
              {change > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-green-700 dark:text-green-400 font-medium">เงินทอน</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    ฿{change.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Warning if not enough */}
              {amountReceived && parseFloat(amountReceived) < cart.totalAmount && (
                <p className="text-sm text-destructive">เงินไม่พอ</p>
              )}
            </div>
          )}

          {/* PromptPay QR - Show for TRANSFER */}
          {selectedMethod === 'TRANSFER' && (
            <div className="border-t pt-4">
              {promptPayId ? (
                <PromptPayQR 
                  promptPayId={promptPayId} 
                  amount={cart.totalAmount} 
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ยังไม่ได้ตั้งค่า PromptPay</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      ไปที่ <span className="inline-flex items-center gap-1"><Settings className="h-3 w-3" />ตั้งค่า</span> → ร้านค้า → กรอก PromptPay ID
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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
              disabled={isProcessing || !isCashValid}
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
