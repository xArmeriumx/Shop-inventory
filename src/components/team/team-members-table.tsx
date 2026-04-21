'use client';

import { useState, useTransition } from 'react';
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
import { updateMemberRole, removeMember } from '@/actions/team';
import { MoreHorizontal, Crown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/use-permissions';

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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  
  const canEditTeam = hasPermission('SETTINGS_ROLES');
  const canRemoveMembers = hasPermission('SETTINGS_ROLES');

  const handleRoleChange = async (memberId: string, roleId: string) => {
    setUpdatingId(memberId);
    try {
      const result = await updateMemberRole(memberId, roleId);
      if (!result.success) {
        alert(result.message);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    const name = member.user.name || member.user.email;
    if (!confirm(`ต้องการลบ ${name} ออกจากทีมหรือไม่?`)) {
      return;
    }

    setUpdatingId(member.id);
    try {
      const result = await removeMember(member.id);
      if (!result.success) {
        alert(result.message);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setUpdatingId(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        ยังไม่มีสมาชิกในทีม
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>สมาชิก</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback>
                    {getInitials(member.user.name, member.user.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {member.user.name || member.user.email}
                  </p>
                  {member.user.name && (
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              {member.isOwner ? (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3" />
                  เจ้าของ
                </Badge>
              ) : canEditTeam ? (
                <Select
                  value={member.role.id}
                  onValueChange={(value) => handleRoleChange(member.id, value)}
                  disabled={updatingId === member.id || isPending}
                >
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm">{member.role.name}</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-green-600 border-green-600">
                Active
              </Badge>
            </TableCell>
            <TableCell>
              {!member.isOwner && canRemoveMembers && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={updatingId === member.id}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleRemove(member)}
                      className="text-destructive"
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
  );
}
