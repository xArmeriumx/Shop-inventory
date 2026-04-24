'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { CheckCircle, Loader2, CreditCard, Wallet, Smartphone, QrCode, Settings, Camera, ImageIcon, X, ShieldCheck } from 'lucide-react';
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
import { uploadToStorage, RECEIPTS_BUCKET } from '@/lib/supabase-browser';

interface POSPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: POSCart;
  onConfirm: (paymentMethod: string, amountReceived?: number, change?: number, receiptUrl?: string) => Promise<void>;
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
 * With cash amount input, change calculation, PromptPay QR, and slip upload
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
  
  // Slip upload state
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on dialog open
  useEffect(() => {
    if (isOpen) {
      setAmountReceived('');
      setChange(0);
      setSlipPreview(null);
      setSlipFile(null);
      setUploadedUrl(null);
      setIsUploading(false);
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

  // Handle slip file selection
  const handleSlipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
      return;
    }

    setSlipFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setSlipPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove slip
  const handleRemoveSlip = () => {
    setSlipPreview(null);
    setSlipFile(null);
    setUploadedUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload slip to Supabase (direct, same as FileUpload)
  const uploadSlip = async (): Promise<string | null> => {
    if (!slipFile) return null;
    if (uploadedUrl) return uploadedUrl; // Already uploaded

    setIsUploading(true);
    try {
      const result = await uploadToStorage(slipFile, RECEIPTS_BUCKET, 'slips');

      if ('error' in result) {
        throw new Error(result.error);
      }

      setUploadedUrl(result.url);
      return result.url;
    } catch (err) {
      console.error('Slip upload error:', err);
      alert('อัพโหลดสลิปไม่สำเร็จ');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    const received = selectedMethod === 'CASH' ? parseFloat(amountReceived) || cart.totalAmount : undefined;
    const changeAmount = selectedMethod === 'CASH' ? change : undefined;

    // Upload slip if present (for TRANSFER)
    let receiptUrl: string | undefined;
    if (selectedMethod === 'TRANSFER' && slipFile) {
      const url = await uploadSlip();
      if (url) receiptUrl = url;
    }

    await onConfirm(selectedMethod, received, changeAmount, receiptUrl);
  };

  const isCashValid = selectedMethod !== 'CASH' || (parseFloat(amountReceived) || 0) >= cart.totalAmount;
  const hasSlip = !!slipPreview;

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

          {/* Transfer: QR + Slip Upload */}
          {selectedMethod === 'TRANSFER' && (
            <div className="space-y-4 border-t pt-4">
              {/* PromptPay QR */}
              {promptPayId ? (
                <PromptPayQR 
                  promptPayId={promptPayId} 
                  amount={cart.totalAmount} 
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                    <QrCode className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">ยังไม่ได้ตั้งค่า PromptPay</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      ไปที่ <Settings className="h-3 w-3 inline" /> ตั้งค่า → ร้านค้า → กรอก PromptPay ID
                    </p>
                  </div>
                </div>
              )}

              {/* Slip Upload */}
              <div className="space-y-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleSlipSelect}
                />

                {slipPreview ? (
                  /* Slip Preview */
                  <div className="relative border rounded-lg overflow-hidden bg-muted/30">
                    <Image 
                      src={slipPreview} 
                      alt="สลิปการโอนเงิน"
                      className="w-full max-h-[200px] object-contain"
                      width={400}
                      height={200}
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={handleRemoveSlip}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-green-600/90 text-white text-xs py-1.5 px-3 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      แนบสลิปแล้ว
                    </div>
                  </div>
                ) : (
                  /* Upload Button */
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-dashed transition-all',
                      'text-sm font-medium touch-manipulation active:scale-[0.98]',
                      'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Camera className="h-4 w-4" />
                    แนบสลิปการโอนเงิน
                    <span className="text-xs opacity-60">(ไม่บังคับ)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isProcessing || isUploading}
            >
              ยกเลิก
            </Button>
            <Button
              className={cn(
                'flex-1 h-12 transition-all',
                selectedMethod === 'TRANSFER' && !hasSlip && 'opacity-80'
              )}
              onClick={handleConfirm}
              disabled={isProcessing || isUploading || !isCashValid}
            >
              {isProcessing || isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUploading ? 'กำลังอัพโหลดสลิป...' : 'กำลังบันทึก...'}
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {selectedMethod === 'TRANSFER' && !hasSlip
                    ? 'ยืนยัน (ไม่แนบสลิป)'
                    : 'ยืนยันการชำระเงิน'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
