'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { inviteMember } from '@/actions/team';
import { UserPlus } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

interface Role {
  id: string;
  name: string;
  isSystem?: boolean;
}

interface InviteMemberDialogProps {
  roles: Role[];
}

export function InviteMemberDialog({ roles }: InviteMemberDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState('');
  const { hasPermission } = usePermissions();
  
  const canInvite = hasPermission('TEAM_INVITE');

  if (!canInvite) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    if (!roleId) {
      setError('กรุณาเลือก Role');
      return;
    }

    setIsLoading(true);
    try {
      const result = await inviteMember({ email: email.trim(), roleId });
      if (result.success) {
        setOpen(false);
        setEmail('');
        setRoleId('');
        router.refresh();
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด');
      }
    } catch {
      setError('เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          เพิ่มสมาชิก
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>เพิ่มสมาชิกใหม่</DialogTitle>
          <DialogDescription>
            เพิ่มสมาชิกเข้าทีมโดยระบุอีเมลที่ลงทะเบียนแล้ว
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={roleId} onValueChange={setRoleId} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.filter(r => !r.isSystem).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'กำลังเพิ่ม...' : 'เพิ่มสมาชิก'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
