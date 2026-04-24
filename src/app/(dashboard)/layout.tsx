import { getSessionContext } from '@/lib/auth-guard';
import { DashboardLayoutClient } from '@/components/layout/dashboard-layout-client';
import { TutorialWrapper } from '@/components/onboarding/tutorial-wrapper';


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();

  return (
    <DashboardLayoutClient user={ctx ? { name: ctx.userName, email: ctx.userEmail } : undefined}>
      <TutorialWrapper />
      {children}
    </DashboardLayoutClient>
  );
}
