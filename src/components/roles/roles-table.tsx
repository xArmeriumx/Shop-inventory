'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteRole } from '@/actions/roles';
import { Edit, Trash2, Users, Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  permissions: string[];
  _count: { members: number };
}

interface RolesTableProps {
  roles: Role[];
}

export function RolesTable({ roles }: RolesTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  
  const canEditRoles = hasPermission('TEAM_EDIT');

  const handleDelete = async (role: Role) => {
    if (role._count.members > 0) {
      alert(`ไม่สามารถลบได้ เนื่องจากมีสมาชิก ${role._count.members} คนใช้ Role นี้อยู่`);
      return;
    }

    if (!confirm(`ต้องการลบ Role "${role.name}" หรือไม่?`)) {
      return;
    }

    setDeletingId(role.id);
    try {
      const result = await deleteRole(role.id);
      if (!result.success) {
        alert(result.message);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setDeletingId(null);
    }
  };

  if (roles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        ยังไม่มี Role ที่สร้าง
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>สิทธิ์</TableHead>
          <TableHead className="text-center">สมาชิก</TableHead>
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    {role.isDefault && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                    {role.isSystem && (
                      <Badge variant="outline" className="text-xs">System</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">
                {role.permissions.length} สิทธิ์
              </span>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{role._count.members}</span>
              </div>
            </TableCell>
            <TableCell>
              {!role.isSystem && canEditRoles && (
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/settings/roles/${role.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(role)}
                    disabled={deletingId === role.id || isPending || role._count.members > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
