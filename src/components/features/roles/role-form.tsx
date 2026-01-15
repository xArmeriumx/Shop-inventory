'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { updateRole } from '@/actions/roles';
import { PERMISSION_GROUPS } from '@/lib/permissions';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isSystem: boolean;
  permissions: string[];
}

interface RoleFormProps {
  role: Role;
}

export function RoleForm({ role }: RoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || '');
  const [isDefault, setIsDefault] = useState(role.isDefault);
  const [permissions, setPermissions] = useState<string[]>(role.permissions);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setPermissions(prev => {
      if (checked) {
        return [...prev, permission];
      } else {
        return prev.filter(p => p !== permission);
      }
    });
  };

  const handleGroupToggle = (groupPerms: readonly { key: string }[], checked: boolean) => {
    const groupKeys = groupPerms.map(p => p.key);
    setPermissions(prev => {
      const others = prev.filter(p => !groupKeys.includes(p));
      return checked ? [...others, ...groupKeys] : others;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (role.isSystem) {
      toast.error('ไม่สามารถแก้ไข Role ระบบได้');
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateRole(role.id, {
          name,
          description: description || undefined,
          isDefault,
          permissions: permissions as any, // Cast to match Permission enum
        });

        if (result.success) {
          toast.success('บันทึกข้อมูลสำเร็จ');
          router.refresh();
          router.push('/settings/roles');
        } else {
          toast.error(result.message);
        }
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการบันทึก');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">ชื่อ Role</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending || role.isSystem}
            placeholder="เช่น ผู้จัดการ, พนักงานขาย"
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="description">คำอธิบาย</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending || role.isSystem}
            placeholder="อธิบายหน้าที่และความรับผิดชอบ"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="isDefault"
            checked={isDefault}
            onCheckedChange={(checked) => setIsDefault(checked as boolean)}
            disabled={isPending || role.isSystem}
          />
          <Label htmlFor="isDefault">ตั้งเป็น Role เริ่มต้นสำหรับสมาชิกใหม่</Label>
        </div>
      </div>

      <Separator />

      {/* Permissions */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">สิทธิ์การใช้งาน</h3>
          <p className="text-sm text-muted-foreground">
            กำหนดสิ่งที่ Role นี้สามารถทำได้ในระบบ
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => {
            const groupPermKeys = group.permissions.map(p => p.key);
            const allChecked = groupPermKeys.every(k => permissions.includes(k));
            const someChecked = groupPermKeys.some(k => permissions.includes(k));
            const isIndeterminate = someChecked && !allChecked;

            return (
              <div key={groupKey} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox
                    id={`group-${groupKey}`}
                    checked={allChecked}
                    onCheckedChange={(checked) => handleGroupToggle(group.permissions, checked as boolean)}
                    disabled={isPending || role.isSystem}
                  />
                  <Label htmlFor={`group-${groupKey}`} className="font-semibold text-base">
                    {group.label}
                  </Label>
                </div>
                
                <div className="space-y-2">
                  {group.permissions.map((perm) => (
                    <div key={perm.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={perm.key}
                        checked={permissions.includes(perm.key)}
                        onCheckedChange={(checked) => handlePermissionChange(perm.key, checked as boolean)}
                        disabled={isPending || role.isSystem}
                      />
                      <Label htmlFor={perm.key} className="cursor-pointer font-normal">
                        {perm.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          ยกเลิก
        </Button>
        <Button 
          type="submit" 
          disabled={isPending || role.isSystem}
        >
          {isPending ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </Button>
      </div>
    </form>
  );
}
