'use client';

import { useState } from 'react';
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
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { createStockTakeAction } from '@/actions/stock-take';
import { toast } from 'sonner';

interface StockTakeSetupModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productIds: string[]; // List of IDs to audit
    totalCount: number;
}

export function StockTakeSetupModal({ open, onOpenChange, productIds, totalCount }: StockTakeSetupModalProps) {
    const router = useRouter();
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleConfirm = async () => {
        if (productIds.length === 0) {
            toast.error('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ');
            return;
        }

        setIsLoading(true);
        try {
            const session = await createStockTakeAction(productIds, notes);
            toast.success('เริ่มรายการตรวจนับแล้ว');
            onOpenChange(false);
            router.push(`/inventory/stock-take/${session.id}`);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
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
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        ยกเลิก
                    </Button>
                    <Button onClick={handleConfirm} disabled={isLoading} className="gap-2">
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        เริ่ม Snapshot และตรวจนับ
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
