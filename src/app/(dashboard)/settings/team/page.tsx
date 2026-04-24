import { Suspense } from 'react';
import Link from 'next/link';
import { getTeamMembers, getShopTeamInfo } from '@/actions/core/team.actions';
import { getRoles } from '@/actions/core/roles.actions';
import { TeamMembersTable } from '@/components/core/team/team-members-table';
import { InviteMemberDialog } from '@/components/core/team/invite-member-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { MetricGrid } from '@/components/ui/metric-card';
import { Users, ShieldCheck } from 'lucide-react';
import Loading from '@/app/(dashboard)/loading';
import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/core/auth/guard';

async function TeamContent() {
  await requirePermission('SETTINGS_ROLES');

  const [members, roles, shopInfo] = await Promise.all([
    getTeamMembers(),
    getRoles(),
    getShopTeamInfo(),
  ]);

  const stats = [
    {
      label: 'สมาชิกทั้งหมด',
      value: `${shopInfo?._count.members || 0}`,
      hint: 'คนในทีม',
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Roles',
      value: `${shopInfo?._count.roles || 0}`,
      hint: 'ระดับสิทธิ์',
      icon: <ShieldCheck className="h-4 w-4" />,
      href: '/settings/roles',
    },
  ];

  return (
    <div className="space-y-6">
      <MetricGrid items={stats} columns={2} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>สมาชิกในทีม</CardTitle>
            <CardDescription>จัดการสมาชิกและสิทธิ์การเข้าถึง</CardDescription>
          </div>
          <Guard permission="SETTINGS_ROLES">
            <InviteMemberDialog roles={roles} />
          </Guard>
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
      <BackPageHeader
        backHref="/settings"
        title="จัดการทีม"
        description="เพิ่มและจัดการสมาชิกในร้านของคุณ"
      />
      <Suspense fallback={<Loading />}>
        <TeamContent />
      </Suspense>
    </div>
  );
}
