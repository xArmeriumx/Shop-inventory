'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { bulkPostInvoices } from '@/actions/sales/invoices.actions';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';

interface BulkPostButtonProps {
    pendingCount: number;
}

export function BulkPostButton({ pendingCount }: BulkPostButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

    const handleBulkPost = async () => {
        setLoading(true);
        try {
            const res = await bulkPostInvoices();
            if (res.success && res.data) {
                setResult(res.data);
                router.refresh();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setResult(null);
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="border-amber-400 text-amber-600 hover:bg-amber-50 gap-2"
                onClick={() => setOpen(true)}
            >
                <BookOpen className="h-4 w-4" />
                Post รายการค้าง ({pendingCount})
            </Button>

            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Post ใบแจ้งหนี้ค้างลงบัญชี</DialogTitle>
                        <DialogDescription>
                            มี {pendingCount} รายการที่ขายสำเร็จแล้วแต่ยังไม่ได้ลงบัญชี
                            (เกิดจากการขาย POS ก่อนตั้งค่าผังบัญชี)
                        </DialogDescription>
                    </DialogHeader>

                    {result ? (
                        <div className="space-y-3 py-2">
                            {result.success > 0 && (
                                <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-lg p-3">
                                    <CheckCircle className="h-5 w-5 shrink-0" />
                                    <span className="text-sm font-medium">Post สำเร็จ {result.success} รายการ</span>
                                </div>
                            )}
                            {result.failed > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                        <span className="text-sm font-medium">ล้มเหลว {result.failed} รายการ</span>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto pl-2">
                                        {result.errors.map((e, i) => (
                                            <li key={i} className="truncate">• {e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-2 text-sm text-muted-foreground">
                            ระบบจะ Post ใบแจ้งหนี้ที่ชำระแล้วทั้งหมดเข้าสมุดบัญชีหลัก
                            <br />
                            <span className="text-amber-600 font-medium">⚠️ กรุณาตั้งค่าผังบัญชี (CoA) ให้ครบก่อนดำเนินการ</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose} disabled={loading}>
                            {result ? 'ปิด' : 'ยกเลิก'}
                        </Button>
                        {!result && (
                            <Button onClick={handleBulkPost} disabled={loading} className="gap-2">
                                {loading ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> กำลัง Post...</>
                                ) : (
                                    <><BookOpen className="h-4 w-4" /> เริ่ม Post</>
                                )}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
