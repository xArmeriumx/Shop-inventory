import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth-guard';
import { Security } from '@/services/security';
import { AuditLogViewer } from '@/components/features/settings/audit-log-viewer';
import { SecurityDashboardCards } from '@/components/features/settings/security-dashboard';
import { Separator } from '@/components/ui/separator';
import Loading from '@/app/(dashboard)/loading';

export default async function AuditSettingsPage() {
  // Page-level guard just in case the layout doesn't catch it
  const sessionCtx = await requireAuth();
  const ctx = sessionCtx as any;
  Security.requireAnyPermission(ctx, ['TEAM_EDIT', 'SETTINGS_SHOP']);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">ประวัติความปลอดภัย (Security Dashboard & Audit Logs)</h1>
      </div>
      
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
