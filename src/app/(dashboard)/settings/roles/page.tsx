import { Suspense } from 'react';
import { getRoles } from '@/actions/core/roles.actions';
import { RolesTable } from '@/components/core/roles/roles-table';
import { CreateRoleDialog } from '@/components/core/roles/create-role-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import Loading from '@/app/(dashboard)/loading';
import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/core/auth/guard';

async function RolesContent() {
  await requirePermission('SETTINGS_ROLES');
  const result = await getRoles();
  const roles = result.success ? result.data : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Roles ทั้งหมด</CardTitle>
          <CardDescription>กำหนดสิทธิ์การเข้าถึงสำหรับสมาชิกในทีม</CardDescription>
        </div>
        <Guard permission="SETTINGS_ROLES">
          <CreateRoleDialog />
        </Guard>
      </CardHeader>
      <CardContent>
        <RolesTable roles={roles as any} />
      </CardContent>
    </Card>
  );
}

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Loading />}>
        <RolesContent />
      </Suspense>
    </div>
  );
}
