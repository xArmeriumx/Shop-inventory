'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardCheck, Loader2, Warehouse } from 'lucide-react';
import { createStockTakeAction } from '@/actions/inventory/stock-take.actions';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { runActionWithToast } from '@/lib/mutation-utils';

interface StockTakeSetupModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productIds: string[]; // List of IDs to audit
    totalCount: number;
    inventoryMode: string;
    warehouses: any[];
}

export function StockTakeSetupModal({
    open,
    onOpenChange,
    productIds,
    totalCount,
    inventoryMode,
    warehouses
}: StockTakeSetupModalProps) {
    const router = useRouter();
    const [notes, setNotes] = useState('');
    const [warehouseId, setWarehouseId] = useState<string>('');
    const [isPending, startTransition] = useTransition();

    // SINGLE mode: auto-select the first active warehouse
    useEffect(() => {
        if (inventoryMode === 'SINGLE' && warehouses.length > 0) {
            const defaultWh = warehouses.find(w => w.isActive) ?? warehouses[0];
            setWarehouseId(defaultWh.id);
        }
    }, [inventoryMode, warehouses, open]);

    const handleConfirm = () => {
        if (productIds.length === 0) {
            runActionWithToast(Promise.resolve({ success: false, message: 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ' }));
            return;
        }

        if (inventoryMode === 'MULTI' && !warehouseId) {
            runActionWithToast(Promise.resolve({ success: false, message: 'กรุณาเลือกคลังสินค้าที่ต้องการตรวจนับ' }));
            return;
        }

        startTransition(async () => {
            await runActionWithToast(createStockTakeAction(productIds, notes, warehouseId || undefined), {
                successMessage: 'เริ่มรายการตรวจนับและ Snapshot สต็อกเรียบร้อยแล้ว',
                onSuccess: (result) => {
                    const data = result as any;
                    onOpenChange(false);
                    setTimeout(() => {
                        router.push(`/inventory/stock-take/${data.id}`);
                        router.refresh();
                    }, 100);
                },
            });
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ClipboardCheck className="w-5 h-5 text-primary" />
                        เริ่มการตรวจนับสต็อก
                    </DialogTitle>
                    <DialogDescription>
                        ระบบจะทำการ Snapshot สต็อกปัจจุบันของสินค้า {totalCount} รายการที่เลือก
                        เพื่อใช้เป็นฐานในการคำนวณผลต่าง
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Warehouse Selector for MULTI and SINGLE mode */}
                    {(inventoryMode === 'MULTI' || inventoryMode === 'SINGLE') && (
                        <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                                <Warehouse className="w-4 h-4 text-muted-foreground" />
                                คลังสินค้าที่ตรวจนับ {inventoryMode === 'MULTI' ? '*' : ''}
                            </Label>
                            <Select
                                value={warehouseId}
                                onValueChange={setWarehouseId}
                                disabled={inventoryMode === 'SINGLE'}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="เลือกคลังพัสดุ..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.filter(w => w.isActive).map((w) => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {inventoryMode === 'SINGLE' && (
                                <p className="text-[10px] text-muted-foreground italic">
                                    ระบบล็อกคลังสินค้าหลักสำหรับโหมดค่าย่อย
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>หมายเหตุสำหรับการตรวจสอบ (Optional)</Label>
                        <Textarea
                            placeholder="เช่น ตรวจนับประจำเดือนเมษายน, ตรวจสอบก่อนปิดรอบ"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-24"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleConfirm} disabled={isPending} className="gap-2">
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        เริ่ม Snapshot และตรวจนับ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
