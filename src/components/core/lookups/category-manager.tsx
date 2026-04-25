'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Palette } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { 
  createLookupValue, 
  updateLookupValue, 
  deleteLookupValue 
} from '@/actions/core/lookups.actions';
import { LookupTypeCode } from '@prisma/client';
import { runActionWithToast } from '@/lib/mutation-utils';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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

export function CategoryManager({ title, typeCode, values }: CategoryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupValue | null>(null);
  const [deletingItem, setDeletingItem] = useState<LookupValue | null>(null);

  // Form State for Add/Edit
  const [formData, setFormData] = useState({ name: '', color: '#6b7280' });

  const handleOpenAdd = () => {
    setFormData({ name: '', color: '#6b7280' });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item: LookupValue) => {
    setFormData({ name: item.name, color: item.color || '#6b7280' });
    setEditingItem(item);
  };

  const handleSave = () => {
    startTransition(async () => {
      const action = editingItem 
        ? updateLookupValue(editingItem.id, formData)
        : createLookupValue(typeCode, formData);

      await runActionWithToast(action, {
        successMessage: editingItem ? 'แก้ไขหมวดหมู่เรียบร้อยแล้ว' : 'เพิ่มหมวดหมู่เรียบร้อยแล้ว',
        onSuccess: () => {
          setIsAddOpen(false);
          setEditingItem(null);
          router.refresh();
        }
      });
    });
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    startTransition(async () => {
      await runActionWithToast(deleteLookupValue(deletingItem.id), {
        successMessage: 'ลบหมวดหมู่เรียบร้อยแล้ว',
        onSuccess: () => {
          setDeletingItem(null);
          router.refresh();
        }
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 border-dashed"
          onClick={handleOpenAdd}
        >
          <Plus className="h-4 w-4 mr-1" />
          เพิ่มหมวดหมู่
        </Button>
      </div>

      {values.length === 0 ? (
        <div className="text-center py-8 border rounded-xl border-dashed bg-muted/5">
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล กดปุ่ม &ldquo;เพิ่ม&rdquo; เพื่อเริ่มจัดการ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {values.map((item) => (
            <div 
              key={item.id} 
              className="group flex items-center justify-between p-3 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="h-3 w-3 rounded-full flex-shrink-0 shadow-inner"
                  style={{ backgroundColor: item.color || '#6b7280' }}
                />
                <span className="text-sm font-medium">{item.name}</span>
                {item.isSystem && (
                  <span className="text-[9px] uppercase tracking-tighter bg-muted px-1.5 py-0.5 rounded text-muted-foreground">System</span>
                )}
              </div>
              
              {!item.isSystem && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => handleOpenEdit(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingItem(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog 
        open={isAddOpen || !!editingItem} 
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingItem(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</DialogTitle>
            <DialogDescription>
              กำหนดชื่อและสีที่ต้องการใช้แสดงผลในรายงานและหน้าขาย
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อหมวดหมู่</Label>
              <Input 
                id="name" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น สินค้าโปรโมชั่น, อาหารสด"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                สีประจำหมวดหมู่
              </Label>
              <div className="flex items-center gap-3">
                <Input 
                  id="color" 
                  type="color" 
                  className="w-16 h-10 p-1 rounded-lg cursor-pointer"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <span className="text-xs text-muted-foreground font-mono">{formData.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsAddOpen(false); setEditingItem(null); }}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={isPending || !formData.name}>
              {isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบหมวดหมู่</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบหมวดหมู่ &ldquo;{deletingItem?.name}&rdquo; ใช่หรือไม่? 
              <br />
              <span className="text-destructive font-semibold text-xs text-balance">
                การกระทำนี้ไม่สามารถย้อนกลับได้ และจะไม่สามารถลบได้หากยังมีสินค้าหรือรายการบัญชีอ้างอิงอยู่
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDelete(); }} 
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {isPending ? 'กำลังลบ...' : 'ลบข้อมูล'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
