'use client';

import { useState, useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createLookupValue, updateLookupValue, deleteLookupValue } from '@/actions/core/lookups.actions';
import { LookupTypeCode } from '@prisma/client';

interface LookupValue {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  isSystem: boolean;
}

interface CategoryManagerProps {
  title: string;
  typeCode: LookupTypeCode;
  values: LookupValue[];
}

const initialState = {};

function SubmitButton({ text = 'บันทึก' }: { text?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'กำลังบันทึก...' : text}
    </Button>
  );
}

function AddCategoryDialog({ typeCode, onSuccess }: { typeCode: LookupTypeCode; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createLookupValue.bind(null, typeCode), { success: false } as any);

  // Handle success with useEffect to avoid setState during render
  useEffect(() => {
    if (state.success) {
      setOpen(false);
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          เพิ่ม
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
          <DialogDescription>กรอกชื่อหมวดหมู่ที่ต้องการเพิ่ม</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อหมวดหมู่</Label>
            <Input id="name" name="name" required placeholder="เช่น อาหาร, เครื่องดื่ม" />
            {state.fieldErrors?.name && (
              <p className="text-sm text-red-500">{state.fieldErrors.name[0]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">สี (optional)</Label>
            <div className="flex gap-2">
              <Input id="color" name="color" type="color" className="w-16 h-10 p-1" defaultValue="#6b7280" />
            </div>
          </div>
          {state.error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function DeleteCategoryDialog({
  item,
  onSuccess
}: {
  item: LookupValue;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteLookupValue(item.id);
    setDeleting(false);

    if (!result.success) {
      setError(result.message || 'เกิดข้อผิดพลาด');
      return;
    }
    setOpen(false);
    onSuccess();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
          <AlertDialogDescription>
            ต้องการลบหมวดหมู่ &ldquo;{item.name}&rdquo; หรือไม่?
            {error && (
              <span className="block mt-2 text-red-500">{error}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
            {deleting ? 'กำลังลบ...' : 'ลบ'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CategoryManager({ title, typeCode, values }: CategoryManagerProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    // Force revalidation - the page will refresh from server
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <AddCategoryDialog typeCode={typeCode} onSuccess={handleRefresh} />
      </div>

      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          ยังไม่มีข้อมูล กดปุ่ม &ldquo;เพิ่ม&rdquo; เพื่อสร้างหมวดหมู่
        </p>
      ) : (
        <div className="border rounded-lg divide-y">
          {values.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-4 py-2">
              <span className="flex items-center gap-2">
                {item.color && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                )}
                <span className="text-sm">{item.name}</span>
              </span>
              {!item.isSystem && (
                <DeleteCategoryDialog item={item} onSuccess={handleRefresh} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
