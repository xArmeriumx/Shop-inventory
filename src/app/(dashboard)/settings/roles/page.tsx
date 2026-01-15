import { Suspense } from 'react';
import Link from 'next/link';
import { getRoles } from '@/actions/roles';
import { RolesTable } from '@/components/features/roles/roles-table';
import { CreateRoleDialog } from '@/components/features/roles/create-role-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Loading from '@/app/(dashboard)/loading';

async function RolesContent() {
  const roles = await getRoles();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Roles ทั้งหมด</CardTitle>
          <CardDescription>กำหนดสิทธิ์การเข้าถึงสำหรับสมาชิกในทีม</CardDescription>
        </div>
        <CreateRoleDialog />
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการ Roles</h1>
          <p className="text-muted-foreground">สร้างและจัดการสิทธิ์สำหรับสมาชิก</p>
        </div>
      </div>

      <Suspense fallback={<Loading />}>
        <RolesContent />
      </Suspense>
    </div>
  );
}
