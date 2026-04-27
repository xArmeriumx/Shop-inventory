'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, Loader2, Warehouse, ArrowRight } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { transferStockAction } from '@/actions/inventory/warehouse.actions';
import { runActionWithToast } from '@/lib/mutation-utils';

interface StockTransferDialogProps {
    productId: string;
    productName: string;
    warehouses: any[]; // Full warehouse list
    stockRows: any[];  // Current product stocks in each warehouse
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export function StockTransferDialog({
    productId,
    productName,
    warehouses,
    stockRows,
    onSuccess,
    trigger
}: StockTransferDialogProps) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [fromWhId, setFromWhId] = useState<string>('');
    const [toWhId, setToWhId] = useState<string>('');
    const [quantity, setQuantity] = useState<number>(0);
    const [notes, setNotes] = useState('');

    const sourceStock = stockRows.find(r => r.warehouseId === fromWhId)?.quantity || 0;

    const handleTransfer = async () => {
        if (!fromWhId || !toWhId || fromWhId === toWhId) {
            runActionWithToast(Promise.resolve({ success: false, message: 'กรุณาเลือกคลังต้นทางและปลายทางให้ถูกต้อง' }));
            return;
        }

        if (quantity <= 0 || quantity > sourceStock) {
            runActionWithToast(Promise.resolve({ success: false, message: 'จำนวนที่โอนไม่ถูกต้องหรือยอดคงเหลือไม่เพียงพอ' }));
            return;
        }

        startTransition(async () => {
            await runActionWithToast(transferStockAction({
                productId,
                fromWarehouseId: fromWhId,
                toWarehouseId: toWhId,
                quantity,
                notes
            }), {
                successMessage: 'โอนย้ายสินค้าสำเร็จ',
                onSuccess: () => {
                    setOpen(false);
                    if (onSuccess) onSuccess();
                }
            });
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowRightLeft className="w-4 h-4" />
                        โอนย้ายระหว่างคลัง
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-primary" />
                        โอนย้ายสินค้า
                    </DialogTitle>
                    <DialogDescription>
                        ย้ายพัสดุ &quot;{productName}&quot; ระหว่างคลังสินค้าภายในร้าน
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-2">
                        <div className="space-y-2">
                            <Label>จากคลังสินค้า (ต้นทาง)</Label>
                            <Select value={fromWhId} onValueChange={setFromWhId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือก..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {stockRows.filter(r => r.quantity > 0).map((row) => (
                                        <SelectItem key={row.warehouseId} value={row.warehouseId}>
                                            {row.warehouse?.name} ({row.quantity})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-6 hidden md:block">
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>

                        <div className="space-y-2">
                            <Label>ไปที่คลังสินค้า (ปลายทาง)</Label>
                            <Select value={toWhId} onValueChange={setToWhId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือก..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses
                                        .filter(w => w.id !== fromWhId && w.isActive)
                                        .map((w) => (
                                            <SelectItem key={w.id} value={w.id}>
                                                {w.name}
                                            </SelectItem>
                                        ))
                                    }
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>จำนวนที่โอน {fromWhId && <span className="text-xs text-muted-foreground">(คงเหลือ {sourceStock} หน่วย)</span>}</Label>
                        <Input
                            type="number"
                            min={1}
                            max={sourceStock}
                            value={quantity || ''}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            placeholder="ระบุจำนวน..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>หมายเหตุ (Optional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="ระบุเหตุผลการโอน..."
                            className="h-20"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleTransfer} disabled={isPending || !fromWhId || !toWhId || !quantity} className="gap-2">
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        ยืนยันการโอน
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
