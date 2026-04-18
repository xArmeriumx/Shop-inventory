'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { ReceiptScanner } from './receipt-scanner';
import type { ReceiptData } from '@/lib/ocr/types';

interface ScanReceiptDialogProps {
  onScanComplete?: (data: ReceiptData) => void;
  trigger?: React.ReactNode;
}

export function ScanReceiptDialog({ onScanComplete, trigger }: ScanReceiptDialogProps) {
  const [open, setOpen] = useState(false);

  const handleScanComplete = (data: ReceiptData) => {
    setOpen(false);
    onScanComplete?.(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Camera className="h-4 w-4 mr-2" />
            สแกนใบเสร็จ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <ReceiptScanner 
          onScanComplete={handleScanComplete}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
