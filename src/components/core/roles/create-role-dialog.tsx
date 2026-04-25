'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, ShieldCheck } from 'lucide-react';
import { createRole } from '@/actions/core/roles.actions';
import { PERMISSION_PRESETS } from '@/lib/permissions';
import { roleFormSchema, getRoleFormDefaults, type RoleFormValues } from '@/schemas/core/role-form.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { usePermissions } from '@/hooks/use-permissions';

export function CreateRoleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  
  const methods = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: getRoleFormDefaults(),
  });

  const { register, handleSubmit, setValue, watch, reset } = methods;
  const selectedPreset = watch('name'); // We can use Name to detect if preset was picked, or add a field.

  if (!hasPermission('SETTINGS_ROLES')) return null;

  const handleApplyPreset = (presetKey: string) => {
    const permissions = PERMISSION_PRESETS[presetKey as keyof typeof PERMISSION_PRESETS] || [];
    setValue('permissions', [...permissions] as any);
    
    // Auto-fill name if empty
    if (!watch('name')) {
        const labelMap: Record<string, string> = {
            'MANAGER': 'ผู้จัดการ',
            'CASHIER': 'แคชเชียร์',
            'STOCK_KEEPER': 'เจ้าหน้าที่คลังสินค้า'
        };
        setValue('name', labelMap[presetKey] || presetKey);
    }
  };

  const onSubmit = (data: RoleFormValues) => {
    startTransition(async () => {
      await runActionWithToast(createRole(data), {
        successMessage: 'สร้าง Role ใหม่สำเร็จแล้ว',
        onSuccess: () => {
          setOpen(false);
          reset();
          router.refresh();
        },
        onError: (result) => {
          if (result.errors) {
            mapActionErrorsToForm(methods, result.errors);
          }
        }
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) reset(); }}>
      <DialogTrigger asChild>
        <Button className="shadow-sm">
          <PlusCircle className="mr-2 h-4 w-4" />
          สร้าง Role ใหม่
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            สร้าง Role ใหม่
          </DialogTitle>
          <DialogDescription>
            กำหนดชื่อและชุดสิทธิ์เริ่มต้น (Presets) เพื่อความรวดเร็ว
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="preset" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  เลือกจากแม่แบบ (Optional Preset)
                </Label>
                <Select onValueChange={handleApplyPreset}>
                  <SelectTrigger id="preset" className="bg-muted/30 border-dashed">
                    <SelectValue placeholder="เลือกจากชุดสิทธิ์สำเร็จรูป..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANAGER">ผู้จัดการ (สิทธิ์เกือบทุกอย่าง)</SelectItem>
                    <SelectItem value="CASHIER">แคชเชียร์ (ขายและ POS)</SelectItem>
                    <SelectItem value="STOCK_KEEPER">เจ้าหน้าที่คลังสินค้า (สต็อกและสั่งซื้อ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FormField name="name" label="ชื่อ Role" required>
                <Input
                  id="name"
                  placeholder="เช่น หัวหน้าทีมขาย"
                  {...register('name')}
                  disabled={isPending}
                />
              </FormField>

              <FormField name="description" label="คำอธิบาย">
                <Textarea
                  id="description"
                  placeholder="อธิบายสิทธิ์หน้าที่ย่อๆ"
                  className="resize-none"
                  rows={2}
                  {...register('description')}
                  disabled={isPending}
                />
              </FormField>
              
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-primary flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <p>คุณสามารถปรับแต่งสิทธิ์อย่างละเอียดได้ในหน้าแก้ไขหลังจากสร้าง Role เสร็จสิ้น</p>
              </div>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setOpen(false)} 
                disabled={isPending}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'กำลังบันทึก...' : 'สร้างและกำหนดสิทธิ์'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
