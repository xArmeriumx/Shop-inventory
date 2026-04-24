'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SafeInput } from '@/components/ui/safe-input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Building2, Loader2 } from 'lucide-react';
import { createSupplier } from '@/actions/purchases/suppliers.actions';
import { toast } from 'sonner';

interface QuickAddSupplierDialogProps {
  /** Pre-fill supplier name from OCR */
  defaultName?: string;
  /** Callback when supplier is created */
  onCreated?: (supplier: { id: string; name: string }) => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'icon';
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

export function QuickAddSupplierDialog({
  defaultName = '',
  onCreated,
  variant = 'outline',
  size = 'sm',
  trigger,
}: QuickAddSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening dialog
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(defaultName);
      setCode('');
      setPhone('');
      setError(null);
    }
    setOpen(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('กรุณากรอกชื่อผู้จำหน่าย');
      return;
    }

    startTransition(async () => {
      const result = await createSupplier({
        name: name.trim(),
        code: code.trim() || null,
        phone: phone.trim() || null,
        contactName: null,
        email: null,
        address: null,
        taxId: null,
        notes: null,
      });

      if (result.success && result.data) {
        toast.success('เพิ่มผู้จำหน่ายสำเร็จ');
        onCreated?.({ id: result.data.id, name: result.data.name });
        setOpen(false);
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} type="button">
            <Plus className="h-4 w-4 mr-1" />
            เพิ่ม
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            เพิ่มผู้จำหน่ายใหม่
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="supplier-name">ชื่อผู้จำหน่าย *</Label>
            <Input
              id="supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น SAGASONIC, KT Dream Power"
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier-code">รหัส (ถ้ามี)</Label>
              <Input
                id="supplier-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="เช่น SUP001"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">เบอร์โทร</Label>
              <SafeInput
                id="supplier-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="เช่น 0812345678"
                numericOnly
                maxLength={10}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
