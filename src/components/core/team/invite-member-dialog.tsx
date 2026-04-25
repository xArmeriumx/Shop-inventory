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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { inviteMember } from '@/actions/core/team.actions';
import { UserPlus, Mail, Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { inviteMemberSchema, getInviteMemberDefaults, type InviteMemberValues } from '@/schemas/core/team.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

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
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = usePermissions();
  
  const methods = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: getInviteMemberDefaults(),
  });

  const { register, handleSubmit, setValue, watch, reset } = methods;

  if (!hasPermission('SETTINGS_ROLES')) return null;

  const onSubmit = (data: InviteMemberValues) => {
    startTransition(async () => {
      await runActionWithToast(inviteMember(data), {
        successMessage: 'ส่งคำเชิญสมาชิกเรียบร้อยแล้ว',
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
        <Button size="sm" className="shadow-sm">
          <UserPlus className="mr-2 h-4 w-4" />
          เพิ่มสมาชิก
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            เพิ่มสมาชิกใหม่
          </DialogTitle>
          <DialogDescription>
            ระบุอีเมลของผู้ใช้งานที่ต้องการเชิญเข้าร่วมทีมและกำหนดบทบาทสิทธิ์
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <div className="grid gap-4">
              <FormField name="email" label="อีเมลผู้ใช้งาน" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9"
                    {...register('email')}
                    disabled={isPending}
                  />
                </div>
              </FormField>

              <FormField name="roleId" label="บทบาท (Role)" required>
                <Select 
                  value={watch('roleId')} 
                  onValueChange={(val) => setValue('roleId', val, { shouldValidate: true })}
                  disabled={isPending}
                >
                  <SelectTrigger id="roleId" className="w-full">
                    <SelectValue placeholder="เลือกบทบาทสิทธิ์..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => !r.isSystem).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            {role.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="bg-muted/30 border rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed">
                  <p className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
                      <Shield className="h-3 w-3" />
                      Security Note
                  </p>
                  สมาชิกที่ถูกเชิญจะต้องมีบัญชีในระบบอยู่แล้ว สิทธิ์จะถูกบังคับใช้ทันทีเมื่อสมาชิกเข้าสู่ระบบครั้งถัดไป
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
                {isPending ? 'กำลังส่งคำเชิญ...' : 'ส่งคำเชิญเข้าร่วมทีม'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
