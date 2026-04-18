import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth-guard';
import { Security } from '@/services/security';
import { AuditLogViewer } from '@/components/settings/audit-log-viewer';
import { SecurityDashboardCards } from '@/components/settings/security-dashboard';
import { Separator } from '@/components/ui/separator';
import { BackPageHeader } from '@/components/ui/back-page-header';
import Loading from '@/app/(dashboard)/loading';

export default async function AuditSettingsPage() {
  const sessionCtx = await requireAuth();
  Security.requireAnyPermission(sessionCtx as any, ['TEAM_EDIT', 'SETTINGS_SHOP']);

  return (
    <div className="space-y-6">
      <BackPageHeader
        backHref="/settings"
        title="ประวัติความปลอดภัย"
        description="Security Dashboard & Audit Logs"
      />

      <Suspense fallback={<Loading />}>
        <SecurityDashboardCards />
      </Suspense>

      <Separator className="my-8" />

      <Suspense fallback={<Loading />}>
        <AuditLogViewer />
      </Suspense>
    </div>
  );
}
