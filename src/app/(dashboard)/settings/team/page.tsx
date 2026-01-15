import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamMembers, getShopTeamInfo } from '@/actions/team';
import { getRoles } from '@/actions/roles';
import { TeamMembersTable } from '@/components/features/team/team-members-table';
import { InviteMemberDialog } from '@/components/features/team/invite-member-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, ShieldCheck, UserPlus } from 'lucide-react';
import Loading from '@/app/(dashboard)/loading';

async function TeamContent() {
  const [members, roles, shopInfo] = await Promise.all([
    getTeamMembers(),
    getRoles(),
    getShopTeamInfo(),
  ]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">สมาชิกทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shopInfo?._count.members || 0}</div>
            <p className="text-xs text-muted-foreground">คนในทีม</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shopInfo?._count.roles || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Link href="/settings/roles" className="text-primary hover:underline">
                จัดการ Roles
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>สมาชิกในทีม</CardTitle>
            <CardDescription>จัดการสมาชิกและสิทธิ์การเข้าถึง</CardDescription>
          </div>
          <InviteMemberDialog roles={roles} />
        </CardHeader>
        <CardContent>
          <TeamMembersTable members={members} roles={roles} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการทีม</h1>
          <p className="text-muted-foreground">เพิ่มและจัดการสมาชิกในร้านของคุณ</p>
        </div>
      </div>

      <Suspense fallback={<Loading />}>
        <TeamContent />
      </Suspense>
    </div>
  );
}
