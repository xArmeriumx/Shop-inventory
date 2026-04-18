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

import { createCustomer, updateCustomer } from '@/actions/customers';
import { customerFormSchema, getCustomerFormDefaults } from '@/schemas/customer-form';
import type { CustomerFormValues } from '@/schemas/customer-form';

// ============================================================================
// Types
// ============================================================================

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
}

interface CustomerFormProps {
  customer?: Customer;
}

// ============================================================================
// Main: CustomerForm
// ============================================================================

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!customer;

  const methods = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: getCustomerFormDefaults(customer),
  });

  const { handleSubmit, setError, register } = methods;

  function onSubmit(data: CustomerFormValues) {
    // Coerce empty strings to null for optional fields
    const payload = {
      ...data,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      taxId: data.taxId || null,
      notes: data.notes || null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomer(customer.id, payload)
        : await createCustomer(payload);

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
        toast.success(isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มลูกค้าสำเร็จ');
        router.push('/customers');
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
              <FormField name="name" label="ชื่อลูกค้า" required className="sm:col-span-2">
                <Input id="name" {...register('name')} placeholder="ชื่อ-นามสกุล หรือชื่อบริษัท" maxLength={200} />
              </FormField>

              <FormField name="phone" label="เบอร์โทร" hint="เช่น 0812345678">
                <Input id="phone" {...register('phone')} placeholder="เช่น 0812345678" maxLength={10} inputMode="numeric" />
              </FormField>

              <FormField name="email" label="อีเมล">
                <Input id="email" type="email" {...register('email')} placeholder="example@email.com" maxLength={254} />
              </FormField>

              <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" hint="เลข 13 หลัก">
                <Input id="taxId" {...register('taxId')} placeholder="เลข 13 หลัก" maxLength={13} inputMode="numeric" />
              </FormField>

              <FormField name="address" label="ที่อยู่" hint="จำเป็นสำหรับออกใบกำกับภาษี" className="sm:col-span-2">
                <textarea
                  id="address"
                  {...register('address')}
                  placeholder="ที่อยู่สำหรับจัดส่ง"
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
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
                {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
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
