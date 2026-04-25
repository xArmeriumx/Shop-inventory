'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { FormField } from '@/components/ui/form-field';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

import { updateRole } from '@/actions/core/roles.actions';
import { MAP_GROUPS, getPermission } from '@/constants/erp/permissions.constants';
import { roleFormSchema, getRoleFormDefaults } from '@/schemas/core/role-form.schema';
import type { RoleFormValues } from '@/schemas/core/role-form.schema';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

// ============================================================================
// Constants: Permission Dependencies
// ============================================================================

// Dependency mapping is now partially handled by the registry or business logic.
// For now, we'll keep the legacy PERMISSION_DEPENDENCIES but update it to use new keys.
const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  'SALE_CREATE': ['SALE_VIEW', 'PRODUCT_VIEW'],
  'SALE_CANCEL': ['SALE_VIEW'],
  'SALE_VIEW_PROFIT': ['SALE_VIEW'],
  'INVOICE_CREATE': ['INVOICE_VIEW', 'SALE_VIEW'],
  'INVOICE_CANCEL': ['INVOICE_VIEW'],
  'FINANCE_MANAGE': ['FINANCE_VIEW'],
  'PRODUCT_CREATE': ['PRODUCT_VIEW'],
  'PRODUCT_UPDATE': ['PRODUCT_VIEW'],
  'STOCK_CORRECT': ['STOCK_VIEW'],
  'TEAM_MANAGE': ['SETTINGS_ROLES'],
};

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Sub-component: PermissionGroup
// ============================================================================

function PermissionGroup({ groupKey, group, isPending, isSystem }: {
  groupKey: string,
  group: any,
  isPending: boolean,
  isSystem: boolean
}) {
  const { watch, setValue } = useFormContext<RoleFormValues>();
  const currentPermissions = watch('permissions');

  const groupPermKeys = group.permissions.map((p: any) => p.key);
  const allChecked = groupPermKeys.every((k: string) => currentPermissions.includes(k));

  const handleToggle = (permission: string, checked: boolean) => {
    let newPermissions = [...currentPermissions];

    if (checked) {
      if (!newPermissions.includes(permission)) {
        newPermissions.push(permission);
      }

      const dependencies = PERMISSION_DEPENDENCIES[permission] || [];
      dependencies.forEach(dep => {
        if (!newPermissions.includes(dep)) {
          newPermissions.push(dep);
        }
      });
    } else {
      newPermissions = newPermissions.filter(p => p !== permission);

      Object.entries(PERMISSION_DEPENDENCIES).forEach(([key, deps]) => {
        if (deps.includes(permission)) {
          newPermissions = newPermissions.filter(p => p !== key);
        }
      });
    }

    setValue('permissions', newPermissions, { shouldDirty: true, shouldValidate: true });
  };

  const handleGroupToggle = (checked: boolean) => {
    let newPermissions = [...currentPermissions];

    group.permissions.forEach((perm: any) => {
      const permission = perm.key;
      if (checked) {
        if (!newPermissions.includes(permission)) {
          newPermissions.push(permission);
        }
        const dependencies = PERMISSION_DEPENDENCIES[permission] || [];
        dependencies.forEach(dep => {
          if (!newPermissions.includes(dep)) {
            newPermissions.push(dep);
          }
        });
      } else {
        newPermissions = newPermissions.filter(p => p !== permission);
        Object.entries(PERMISSION_DEPENDENCIES).forEach(([key, deps]) => {
          if (deps.includes(permission)) {
            newPermissions = newPermissions.filter(p => p !== key);
          }
        });
      }
    });

    setValue('permissions', newPermissions, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="flex items-center space-x-2 pb-2 border-b">
        <Checkbox
          id={`group-${groupKey}`}
          checked={allChecked}
          onCheckedChange={(checked) => handleGroupToggle(checked as boolean)}
          disabled={isPending || isSystem}
        />
        <Label htmlFor={`group-${groupKey}`} className="font-semibold text-base cursor-pointer">
          {group.label}
        </Label>
      </div>

      <div className="space-y-3">
        {group.permissions.map((perm: any) => {
          const meta = getPermission(perm.key);
          const isHighRisk = meta?.risk === 'high';

          return (
            <div key={perm.key} className="flex items-start space-x-2 group">
              <Checkbox
                id={perm.key}
                className="mt-1"
                checked={currentPermissions.includes(perm.key)}
                onCheckedChange={(checked) => handleToggle(perm.key, checked as boolean)}
                disabled={isPending || isSystem}
              />
              <div className="grid gap-1.5 leading-none">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={perm.key}
                    className={`cursor-pointer font-medium ${isHighRisk ? 'text-destructive' : ''}`}
                  >
                    {perm.label}
                  </Label>
                  {isHighRisk && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="h-3 w-3 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>สิทธิ์ที่มีความเสี่ยงสูง: กระทบฐานข้อมูลหรืองบประมาณ</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                {meta?.description && (
                  <p className="text-xs text-muted-foreground">
                    {meta.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main: RoleForm
// ============================================================================

export function RoleForm({ role }: RoleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const methods = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: getRoleFormDefaults(role),
  });

  const { handleSubmit, setError, register } = methods;

  function onSubmit(data: RoleFormValues) {
    if (role.isSystem) {
      toast.error('ไม่สามารถแก้ไข Role ระบบได้');
      return;
    }

    startTransition(async () => {
      await runActionWithToast(updateRole(role.id, data), {
        successMessage: 'บันทึกการเปลี่ยนแปลงสิทธิ์เรียบร้อยแล้ว',
        onSuccess: () => {
          router.refresh();
          router.push('/settings/roles');
        },
        onError: (result) => {
          if (result.errors) {
            mapActionErrorsToForm(methods, result.errors);
          }
        }
      });
    });
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <div className="space-y-4">
          {methods.formState.errors.root && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {methods.formState.errors.root.message}
            </div>
          )}

          <FormField name="name" label="ชื่อ Role" required>
            <Input
              id="name"
              {...register('name')}
              disabled={isPending || role.isSystem}
              placeholder="เช่น ผู้จัดการ, พนักงานขาย"
            />
          </FormField>

          <FormField name="description" label="คำอธิบาย">
            <Textarea
              id="description"
              {...register('description')}
              disabled={isPending || role.isSystem}
              placeholder="อธิบายหน้าที่และความรับผิดชอบ"
            />
          </FormField>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="isDefault"
              checked={methods.watch('isDefault')}
              onCheckedChange={(checked) => methods.setValue('isDefault', checked as boolean, { shouldDirty: true })}
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
            {methods.formState.errors.permissions && (
              <p className="text-sm text-destructive mt-1">{methods.formState.errors.permissions.message}</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(MAP_GROUPS).map(([groupKey, group]) => (
              <PermissionGroup
                key={groupKey}
                groupKey={groupKey}
                group={group}
                isPending={isPending}
                isSystem={role.isSystem}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t pt-6">
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
    </FormProvider>
  );
}
