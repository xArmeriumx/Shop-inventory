import { Suspense } from 'react';
import { getRoles } from '@/actions/roles';
import { RolesTable } from '@/components/roles/roles-table';
import { CreateRoleDialog } from '@/components/roles/create-role-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import Loading from '@/app/(dashboard)/loading';
import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/auth/guard';

async function RolesContent() {
  await requirePermission('SETTINGS_ROLES');
  const roles = await getRoles();

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
        <RolesTable roles={roles} />
      </CardContent>
    </Card>
  );
}

export default function RolesPage() {
  return (
    <div className="space-y-6">
      <BackPageHeader
        backHref="/settings"
        title="จัดการ Roles"
        description="สร้างและจัดการสิทธิ์สำหรับสมาชิก"
      />
      <Suspense fallback={<Loading />}>
        <RolesContent />
      </Suspense>
    </div>
  );
}
