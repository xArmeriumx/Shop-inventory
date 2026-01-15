'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createShop } from '@/actions/onboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { signOut } from 'next-auth/react';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [shopName, setShopName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Default shop name from user's name
  const defaultShopName = session?.user?.name ? `${session.user.name}'s Shop` : 'My Shop';

  const handleCreateShop = async () => {
    try {
      setIsCreating(true);
      const nameToUse = shopName.trim() || defaultShopName;
      
      const result = await createShop(nameToUse);
      
      if (result.success) {
        toast.success('สร้างร้านค้าสำเร็จ');
        
        // Force session update/reload to get new claims (shopId)
        // We need to refresh the page/session to get the new cookie with shopId
        // Using window.location.href to force full reload is safer here than router.push
        window.location.href = '/dashboard'; 
      } else {
        toast.error(result.message);
        setIsCreating(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่');
      setIsCreating(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
            ระบบบริหารจัดการสินค้าและยอดขาย
          </h2>
          <p className="mt-2 text-sm text-gray-600">
             กรุณาเลือกดำเนินการเพื่อเริ่มต้นใช้งานระบบ
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>สำหรับผู้ประกอบการ (Owner)</CardTitle>
            <CardDescription>
              สร้างร้านค้าใหม่เพื่อเริ่มต้นบริหารจัดการระบบสต็อกและยอดขาย
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="shopName" className="text-sm font-medium">
                ชื่อร้านค้า
              </label>
              <Input
                id="shopName"
                placeholder={defaultShopName}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                disabled={isCreating}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateShop} 
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                'ยืนยันการสร้างร้านค้า'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/50 border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">สำหรับพนักงาน (Staff)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              หากท่านเป็นพนักงาน กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าใช้งาน (Invite) 
              เมื่อได้รับสิทธิ์แล้ว ท่านจะสามารถเข้าใช้งานระบบได้ทันที
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" className="text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </div>
      </div>
    </div>
  );
}
