import { auth } from '@/lib/auth';
import { DashboardLayoutClient } from '@/components/layout/dashboard-layout-client';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <DashboardLayoutClient user={session?.user}>
      {children}
    </DashboardLayoutClient>
  );
}
