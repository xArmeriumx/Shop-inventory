'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Camera, ShoppingCart } from 'lucide-react';
import { DocumentScanner } from '@/components/core/ocr/document-scanner';

interface ScanPurchaseButtonProps {
  onScanComplete: (data: any) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ScanPurchaseButton({
  onScanComplete,
  variant = 'outline',
  size = 'default',
}: ScanPurchaseButtonProps) {
  const [open, setOpen] = useState(false);

  const handleScanComplete = (data: any) => {
    onScanComplete(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Camera className="h-4 w-4 mr-2" />
          สแกนใบสั่งซื้อ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            สแกนใบสั่งซื้อ/ใบส่งสินค้า
          </DialogTitle>
        </DialogHeader>
        <DocumentScanner
          documentType="purchase"
          onScanComplete={handleScanComplete}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
