'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { revokeAllUserSessions } from '@/actions/core/auth.actions';

export function SecuritySettings() {
    const [isPending, startTransition] = useTransition();

    const handleRevokeAll = () => {
        if (!confirm('คุณต้องการออกจากระบบในทุกอุปกรณ์ใช่หรือไม่? เซสชันปัจจุบันของคุณจะถูกยกเลิกด้วย')) return;

        startTransition(async () => {
            const result = await revokeAllUserSessions();
            if (result.success) {
                toast.success('ยกเลิกเซสชันทั้งหมดแล้ว กำลังนำท่านไปยังหน้าล็อกอิน...');
                setTimeout(() => {
                    import('next-auth/react').then(({ signOut }) => signOut());
                }, 1500);
            } else {
                toast.error(result.message || 'เกิดข้อผิดพลาด');
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card className="border-destructive/20 shadow-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <ShieldCheck className="h-5 w-5" />
                        ความปลอดภัยและเซสชัน (Security)
                    </CardTitle>
                    <CardDescription>จัดการเซสชันที่ยังค้างอยู่ในระบบและออกจากอุปกรณ์อื่นๆ หากคุณพบความผิดปกติ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                        <p className="text-sm text-destructive font-medium mb-2 uppercase tracking-wider">อันตราย (Danger Zone)</p>
                        <p className="text-sm text-muted-foreground mb-4">
                            การกดปุ่มด้านล่างจะทำให้บัญชีนี้ถูกออกจากระบบในทุกอุปกรณ์ที่กำลังใช้งานอยู่ทันที
                            รวมไปถึงเบราว์เซอร์ที่คุณกำลังใช้งานอยู่นี้ด้วย
                        </p>
                        <Button
                            variant="destructive"
                            onClick={handleRevokeAll}
                            disabled={isPending}
                            className="gap-2"
                        >
                            <LogOut className="h-4 w-4" />
                            ออกจากระบบในทุกอุปกรณ์
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
