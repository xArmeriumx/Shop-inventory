/**
 * Onboarding Page — Genesis Wizard Container
 * Route: /onboarding
 *
 * This page wraps the 5-step GenesisWizard in a clean,
 * scrollable centered layout. Uses a Card for the wizard container.
 * Protected by auth.config.ts: redirects to /dashboard if user already has a shop.
 */
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { signOut } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GenesisWizard } from '@/components/onboarding/genesis-wizard';
import { LogOut, Store } from 'lucide-react';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'เริ่มต้นใช้งาน — ERP',
  description: 'ตั้งค่าธุรกิจของคุณและเริ่มใช้งาน ERP',
};

export default async function OnboardingPage() {
  const session = await auth();

  // Guard: already has shop → redirect to dashboard
  // (Also handled by middleware in auth.config.ts)
  if (session?.user?.shopId) {
    redirect('/dashboard');
  }

  const userName = session?.user?.name ?? 'คุณ';

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      {/* Top nav — minimal, just brand + logout */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center
                            text-primary-foreground text-[10px] font-bold">
              ERP
            </div>
            <span className="text-sm font-semibold">Shop Inventory</span>
          </div>

          <form action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}>
            <Button type="submit" variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              ออกจากระบบ
            </Button>
          </form>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center py-8 px-4">
        <div className="w-full max-w-2xl">
          {/* Welcome header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl
                            bg-primary text-primary-foreground mb-4">
              <Store className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              ยินดีต้อนรับ, {userName}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              มาเริ่มตั้งค่าธุรกิจของคุณ — ใช้เวลาเพียง 5 นาที
            </p>
          </div>

          {/* Wizard card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">ตั้งค่าธุรกิจ</CardTitle>
              <CardDescription>
                ข้อมูลเหล่านี้จะถูกใช้ตลอดทั้งระบบ — เปลี่ยนแปลงได้ภายหลังที่ Settings
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <GenesisWizard />
            </CardContent>
          </Card>

          {/* Staff hint */}
          <div className="mt-4 rounded-lg border border-dashed bg-transparent p-4 text-center">
            <p className="text-xs text-muted-foreground">
              <strong>เป็นพนักงาน?</strong>{' '}
              กรุณาติดต่อเจ้าของร้านเพื่อขอ Invite Link — อย่าสร้างร้านค้าใหม่
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
