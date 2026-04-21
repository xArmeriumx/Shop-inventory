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
import { Textarea } from '@/components/ui/textarea';
import { createRole } from '@/actions/roles';
import { PERMISSION_PRESETS } from '@/lib/permissions';
import { PlusCircle } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CreateRoleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preset, setPreset] = useState('');
  const [error, setError] = useState('');
  const { hasPermission } = usePermissions();
  
  const canEditRoles = hasPermission('SETTINGS_ROLES');

  if (!canEditRoles) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('กรุณากรอกชื่อ Role');
      return;
    }

    if (!preset) {
      setError('กรุณาเลือก Preset');
      return;
    }

    setIsLoading(true);
    try {
      const permissions = [...(PERMISSION_PRESETS[preset as keyof typeof PERMISSION_PRESETS] || [])];
      const result = await createRole({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
      
      if (result.success) {
        setOpen(false);
        setName('');
        setDescription('');
        setPreset('');
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
          <PlusCircle className="mr-2 h-4 w-4" />
          สร้าง Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>สร้าง Role ใหม่</DialogTitle>
          <DialogDescription>
            กำหนดสิทธิ์สำหรับสมาชิกในทีม
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">ชื่อ Role</Label>
              <Input
                id="name"
                placeholder="เช่น ผู้จัดการ, พนักงานขาย"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea
                id="description"
                placeholder="อธิบายหน้าที่ของ Role นี้"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="preset">เลือก Preset สิทธิ์</Label>
              <Select value={preset} onValueChange={setPreset} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือก preset..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANAGER">
                    ผู้จัดการ - สิทธิ์เต็มที่ (ยกเว้นจัดการทีม)
                  </SelectItem>
                  <SelectItem value="CASHIER">
                    แคชเชียร์ - ขายสินค้าและ POS
                  </SelectItem>
                  <SelectItem value="STOCK_KEEPER">
                    ดูแลสต็อก - จัดการสินค้าและสั่งซื้อ
                  </SelectItem>
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
              {isLoading ? 'กำลังสร้าง...' : 'สร้าง Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
