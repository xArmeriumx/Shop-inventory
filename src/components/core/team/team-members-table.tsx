'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { updateMemberRole, removeMember } from '@/actions/core/team.actions';
import { MoreHorizontal, Crown, Trash2, Shield, Mail } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/use-permissions';
import { runActionWithToast } from '@/lib/mutation-utils';

interface TeamMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: {
    id: string;
    name: string;
  };
  isOwner: boolean;
  joinedAt: Date;
}

interface Role {
  id: string;
  name: string;
}

interface TeamMembersTableProps {
  members: TeamMember[];
  roles: Role[];
}

export function TeamMembersTable({ members, roles }: TeamMembersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  
  const canEditTeam = hasPermission('SETTINGS_ROLES');
  const canRemoveMembers = hasPermission('SETTINGS_ROLES');

  const handleRoleChange = (memberId: string, roleId: string) => {
    startTransition(async () => {
      await runActionWithToast(updateMemberRole(memberId, roleId), {
        successMessage: 'เปลี่ยนบทบาทสมาชิกเรียบร้อยแล้ว',
        onSuccess: () => router.refresh()
      });
    });
  };

  const handleRemove = (member: TeamMember) => {
    const name = member.user.name || member.user.email;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการนำ "${name}" ออกจากทีม?\nการกระทำนี้จะมีผลทันทีต่อการเข้าถึงระบบของพนักงาน`)) {
      return;
    }

    startTransition(async () => {
      await runActionWithToast(removeMember(member.id), {
        successMessage: 'ลบสมาชิกออกจากทีมเรียบร้อยแล้ว',
        onSuccess: () => router.refresh()
      });
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl border-dashed bg-muted/5">
        <Mail className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground font-medium">ยังไม่มีสมาชิกในทีมของคุณ</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">สมาชิก</TableHead>
            <TableHead className="font-semibold">บทบาท (Role)</TableHead>
            <TableHead className="font-semibold">สิทธิ์การเข้าใช้งาน</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id} className="hover:bg-muted/30 transition-colors">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9 border shadow-sm">
                    <AvatarImage src={member.user.image || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                      {getInitials(member.user.name, member.user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">
                      {member.user.name || 'ไม่ระบุชื่อ'}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.user.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {member.isOwner ? (
                  <Badge variant="secondary" className="gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
                    <Crown className="h-3 w-3" />
                    Owner
                  </Badge>
                ) : canEditTeam ? (
                  <Select
                    value={member.role.id}
                    onValueChange={(value) => handleRoleChange(member.id, value)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs font-medium bg-background">
                      <Shield className="h-3 w-3 mr-1 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id} className="text-xs">
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    {member.role.name}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-200">
                  Active
                </Badge>
              </TableCell>
              <TableCell>
                {!member.isOwner && canRemoveMembers && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" disabled={isPending}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={() => handleRemove(member)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/5 cursor-pointer"
                        disabled={isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        ลบออกจากทีม
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
