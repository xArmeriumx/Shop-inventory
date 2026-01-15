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
  const [quantity, setQuantity] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const calculateNewStock = () => {
    switch (type) {
      case 'ADD': return currentStock + (quantity || 0);
      case 'REMOVE': return currentStock - (quantity || 0);
      case 'SET': return quantity || 0;
      default: return currentStock;
    }
  };

  const newStock = calculateNewStock();
  const diff = newStock - currentStock;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
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

      if (!result.success) {
        setError(result.message || 'เกิดข้อผิดพลาด');
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
            
            <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                    <span>สต็อกปัจจุบัน:</span>
                    <span className="font-medium">{currentStock}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>ยอดที่ปรับปรุง:</span>
                    <span className={diff > 0 ? "text-green-600 font-medium" : diff < 0 ? "text-red-600 font-medium" : ""}>
                        {diff > 0 ? "+" : ""}{diff}
                    </span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="font-semibold">สต็อกใหม่:</span>
                    <span className="font-bold text-lg">{newStock}</span>
                </div>
            </div>

            <div className="space-y-2">
              <Label>จำนวน</Label>
              <Input
                name="quantity"
                type="number"
                min="1"
                placeholder="ระบุจำนวน"
                required
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
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
