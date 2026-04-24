import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRole } from '@/actions/core/roles.actions';
import { RoleForm } from '@/components/core/roles/role-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Loading from '@/app/(dashboard)/loading';
import { requirePermission } from '@/lib/auth-guard';

interface PageProps {
  params: {
    id: string;
  };
}

async function EditRoleContent({ id }: { id: string }) {
  // Guard: Must have SETTINGS_ROLES permission to edit roles
  await requirePermission('SETTINGS_ROLES');

  const role = await getRole(id);

  if (!role) {
    notFound();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>แก้ไข Role</CardTitle>
        <CardDescription>
          แก้ไขชื่อและกำหนดสิทธิ์สำหรับ Role นี้
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RoleForm role={role} />
      </CardContent>
    </Card>
  );
}

export default function EditRolePage({ params }: PageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings/roles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">แก้ไข Role</h1>
          <p className="text-muted-foreground">ปรับปรุงข้อมูลและสิทธิ์การใช้งาน</p>
        </div>
      </div>

      <Suspense fallback={<Loading />}>
        <EditRoleContent id={params.id} />
      </Suspense>
    </div>
  );
}
