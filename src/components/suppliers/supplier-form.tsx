'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';

import { createSupplier, updateSupplier } from '@/actions/suppliers';
import { supplierFormSchema, getSupplierFormDefaults } from '@/schemas/supplier-form';
import type { SupplierFormValues } from '@/schemas/supplier-form';

// ============================================================================
// Types
// ============================================================================

interface Supplier {
  id: string;
  name: string;
  code: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
}

interface SupplierFormProps {
  supplier?: Supplier;
}

// ============================================================================
// Main: SupplierForm
// ============================================================================

export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!supplier;

  const methods = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: getSupplierFormDefaults(supplier),
  });

  const { handleSubmit, setError, register } = methods;

  function onSubmit(data: SupplierFormValues) {
    const payload = {
      ...data,
      code: data.code || null,
      contactName: data.contactName || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      taxId: data.taxId || null,
      notes: data.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateSupplier(supplier.id, payload)
        : await createSupplier(payload);

      if (!result.success) {
        if (result.errors && typeof result.errors === 'object') {
          Object.entries(result.errors).forEach(([field, messages]) => {
            if (field === '_form') {
              setError('root', { message: (messages as string[]).join(', ') });
            } else {
              setError(field as any, { message: (messages as string[])[0] });
            }
          });
        } else if (result.message) {
          setError('root', { message: result.message });
        }
      } else {
        toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มผู้จำหน่ายสำเร็จ');
        router.push('/suppliers');
        router.refresh();
      }
    });
  }

  return (
    <FormProvider {...methods}>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {methods.formState.errors.root && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {methods.formState.errors.root.message}
              </div>
            )}

            {/* Identity Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="name" label="ชื่อผู้จำหน่าย" required className="sm:col-span-2">
                <Input id="name" {...register('name')} placeholder="ชื่อบริษัท หรือชื่อผู้จำหน่าย" maxLength={200} />
              </FormField>

              <FormField name="code" label="รหัสผู้จำหน่าย" hint="เช่น SUP001">
                <Input id="code" {...register('code')} placeholder="SUP001" maxLength={50} />
              </FormField>

              <FormField name="contactName" label="ชื่อผู้ติดต่อ">
                <Input id="contactName" {...register('contactName')} placeholder="ชื่อ-นามสกุล" maxLength={100} />
              </FormField>

              <FormField name="phone" label="เบอร์โทร" hint="เช่น 0812345678">
                <Input id="phone" {...register('phone')} placeholder="เช่น 0812345678" maxLength={10} inputMode="numeric" />
              </FormField>

              <FormField name="email" label="อีเมล">
                <Input id="email" type="email" {...register('email')} placeholder="email@example.com" maxLength={254} />
              </FormField>

              <FormField name="address" label="ที่อยู่" className="sm:col-span-2">
                <textarea
                  id="address"
                  {...register('address')}
                  placeholder="ที่อยู่บริษัท"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </FormField>

              <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" hint="เลข 13 หลัก">
                <Input id="taxId" {...register('taxId')} placeholder="เลข 13 หลัก" maxLength={13} inputMode="numeric" />
              </FormField>

              <FormField name="notes" label="หมายเหตุ" className="sm:col-span-2">
                <textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="บันทึกเพิ่มเติม"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </FormField>
            </div>

            {/* Action Bar */}
            <div className="flex gap-2 pt-4 border-t">
              <Button type="submit" disabled={isPending} className="px-8">
                {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มผู้จำหน่าย'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                ยกเลิก
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
