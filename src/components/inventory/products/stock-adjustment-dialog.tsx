'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runActionWithToast } from '@/lib/mutation-utils';
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
import { adjustStock } from '@/actions/inventory/products.actions';
import { GuidedErrorAlert } from '@/components/ui/guided-error-alert';
import { ErrorAction } from '@/types/domain';

interface StockAdjustmentDialogProps {
  productId: string;
  currentStock: number;
  inventoryMode: string;
  warehouses: any[];
  warehouseStocks?: any[];
}

export function StockAdjustmentDialog({
  productId,
  currentStock,
  inventoryMode,
  warehouses,
  warehouseStocks = []
}: StockAdjustmentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState('ADD');
  const [quantity, setQuantity] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [errorInfo, setErrorInfo] = useState<{ message: string; action?: ErrorAction } | null>(null);

  // Determine which stock to display based on selected warehouse
  const getDisplayStock = () => {
    if ((inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') && warehouseId) {
      const ws = warehouseStocks.find(s => s.warehouseId === warehouseId);
      return ws ? Number(ws.quantity) : 0;
    }
    return currentStock; // Global stock for SIMPLE
  };

  const activeStock = getDisplayStock();

  const calculateNewStock = () => {
    switch (type) {
      case 'ADD': return activeStock + (quantity || 0);
      case 'REMOVE': return activeStock - (quantity || 0);
      case 'SET': return quantity || 0;
      default: return activeStock;
    }
  };

  const newStock = calculateNewStock();
  const diff = newStock - activeStock;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const reason = formData.get('reason') as string;

    // Safe UI validation
    if (inventoryMode === 'MULTI' && !warehouseId) {
      setErrorInfo({ message: 'กรุณาเลือกคลังสินค้า' });
      return;
    }

    if ((type !== 'SET' && (!quantity || quantity <= 0)) || (type === 'SET' && quantity < 0)) {
      setErrorInfo({ message: 'กรุณาระบุจำนวนที่ถูกต้อง' });
      return;
    }

    if (!reason || reason.trim().length === 0) {
      setErrorInfo({ message: 'กรุณาระบุเหตุผลที่ปรับปรุงสต็อก' });
      return;
    }

    startTransition(async () => {
      await runActionWithToast(adjustStock(productId, {
        type: type as 'ADD' | 'REMOVE' | 'SET',
        quantity,
        note: reason,
        warehouseId: warehouseId || undefined,
      }), {
        successMessage: 'ปรับปรุงสต็อกสำเร็จ',
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
        onError: (result) => {
          setErrorInfo({ message: result.message || 'เกิดข้อผิดพลาด', action: result.action });
        }
      });
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

            {/* Warehouse Selector for MULTI and SINGLE mode */}
            {(inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') && (
              <div className="space-y-2">
                <Label>คลังสินค้า {inventoryMode === 'MULTI' ? '*' : ''}</Label>
                <Select
                  value={warehouseId}
                  onValueChange={setWarehouseId}
                  disabled={inventoryMode === 'SINGLE'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกคลังสินค้า..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.filter(w => w.isActive).map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>{inventoryMode === 'MULTI' && warehouseId ? "คงเหลือในคลังนี้:" : "คงเหลือในคลังรวม:"}</span>
                <span className="font-medium">{activeStock}</span>
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
            {errorInfo && (
              <GuidedErrorAlert
                message={errorInfo.message}
                action={errorInfo.action}
                className="mt-2"
              />
            )}
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
