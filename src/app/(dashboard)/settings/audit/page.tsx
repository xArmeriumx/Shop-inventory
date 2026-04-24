import { Suspense } from 'react';
import { requirePermission } from '@/lib/auth-guard';
import { AuditLogViewer } from '@/components/core/settings/audit-log-viewer';
import { SecurityDashboardCards } from '@/components/core/settings/security-dashboard';
import { Separator } from '@/components/ui/separator';
import { BackPageHeader } from '@/components/ui/back-page-header';
import Loading from '@/app/(dashboard)/loading';

export default async function AuditSettingsPage() {
  await requirePermission('SETTINGS_ROLES');

  return (
    <div className="space-y-6">
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
