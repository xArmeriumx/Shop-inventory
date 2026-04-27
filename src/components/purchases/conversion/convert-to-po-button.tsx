'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { SupplierCombobox } from '@/components/purchases/suppliers/supplier-combobox';
import { convertToPOAction } from '@/actions/purchases/conversion.actions';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useRouter } from 'next/navigation';

interface ConvertToPOButtonProps {
  orderRequestId: string;
}

/**
 * ConvertToPOButton — ปุ่มสำหรับแปลงคำขอซื้อเป็นใบสั่งซื้อ (Manual PO Conversion)
 * 
 * ใช้ SupplierCombobox เพื่อรองรับการเลือกซัพพลายเออร์ที่เหมาะสมก่อนออก PO
 */
export function ConvertToPOButton({ orderRequestId }: ConvertToPOButtonProps) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConvert = async () => {
    if (!supplierId) return;

    setLoading(true);
    await runActionWithToast(
      convertToPOAction(orderRequestId, supplierId),
      {
        loadingMessage: 'กำลังสร้างใบสั่งซื้อ...',
        successMessage: 'สร้างใบสั่งซื้อเรียบร้อยแล้ว',
        onSuccess: (data: any) => {
          if (data?.id) {
            router.push(`/purchases/${data.id}`);
          }
          setOpen(false);
        }
      }
    );
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="bg-blue-600 hover:bg-blue-700">
          <ShoppingCart className="mr-2 h-4 w-4" /> สร้างใบสั่งซื้อ (PO)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แปลงเป็นใบสั่งซื้อ (Convert to PO)</DialogTitle>
          <DialogDescription>
            กรุณาเลือกผู้จำหน่าย (Supplier) ที่ต้องการออกใบสั่งซื้อสินค้าจากรายการคำขอซื้อนี้
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">เลือกผู้จำหน่าย</label>
            <SupplierCombobox 
              value={supplierId} 
              onChange={setSupplierId} 
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleConvert} 
            disabled={!supplierId || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            บันทึกและสร้าง PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
