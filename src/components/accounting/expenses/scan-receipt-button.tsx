'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { ScanReceiptDialog } from '@/components/core/ocr';
import type { ReceiptData } from '@/lib/ocr/types';
import { toast } from 'sonner';

export function ScanReceiptButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleScanComplete = (data: ReceiptData) => {
    // Build query params for the new expense form
    const params = new URLSearchParams();
    
    if (data.vendor) params.set('description', data.vendor);
    if (data.total) params.set('amount', data.total.toString());
    if (data.date) params.set('date', data.date);
    if (data.suggestedCategory) params.set('category', data.suggestedCategory);
    
    toast.success('สแกนสำเร็จ! กรุณาตรวจสอบข้อมูลก่อนบันทึก');
    
    // Navigate to new expense form with pre-filled data
    router.push(`/expenses/new?${params.toString()}`);
  };

  return (
    <ScanReceiptDialog 
      onScanComplete={handleScanComplete}
      trigger={
        <Button variant="outline">
          <Camera className="mr-2 h-4 w-4" />
          สแกนใบเสร็จ
        </Button>
      }
    />
  );
}
