'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adjustStock } from '@/actions/products'; // We will create this action next

interface StockAdjustmentDialogProps {
  productId: string;
  currentStock: number;
}

export function StockAdjustmentDialog({ productId, currentStock }: StockAdjustmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState('ADD');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const quantity = parseInt(formData.get('quantity') as string);
    const reason = formData.get('reason') as string;

    if (!quantity || quantity <= 0) {
      setError('กรุณาระบุจำนวนที่ถูกต้อง');
      return;
    }

    if (!reason || reason.trim().length === 0) {
      setError('กรุณาระบุเหตุผล');
      return;
    }

    startTransition(async () => {
      const result = await adjustStock(productId, {
        type: type as 'ADD' | 'REMOVE' | 'SET',
        quantity,
        note: reason,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">ปรับปรุงสต็อก (Adjust)</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>ปรับปรุงสต็อกสินค้า</DialogTitle>
            <DialogDescription>
              บันทึกการเปลี่ยนแปลงสต็อกด้วยมือ สำหรับกรณีสินค้าหาย, ชำรุด, หรือนับสต็อกใหม่
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>ประเภทรายการ</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADD">รับเข้าเพิ่ม (+)</SelectItem>
                  <SelectItem value="REMOVE">ตัดออก (-)</SelectItem>
                  <SelectItem value="SET">ตั้งค่าใหม่ (Set)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>จำนวน</Label>
              <Input
                name="quantity"
                type="number"
                min="1"
                placeholder="ระบุจำนวน"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>เหตุผล / หมายเหตุ (สำคัญ)</Label>
              <Input
                name="reason"
                placeholder="เช่น พบสินค้าชำรุด, นับสต็อกประจำเดือน"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
