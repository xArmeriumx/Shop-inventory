'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';

import { createSupplier, updateSupplier } from '@/actions/purchases/suppliers.actions';
import { supplierFormSchema, getSupplierFormDefaults } from '@/schemas/purchases/supplier-form.schema';
import type { SupplierFormValues } from '@/schemas/purchases/supplier-form.schema';

import { PartnerIdentitySection } from '@/components/crm/partners/partner-identity-section';
import { PartnerFinancialSection } from '@/components/crm/partners/partner-financial-section';
import { PartnerAddressSection } from '@/components/crm/partners/partner-address-section';
import { SafeBoundary } from '@/components/ui/safe-boundary';

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

  const { handleSubmit, setError } = methods;

  function onSubmit(data: SupplierFormValues) {
    // Bridge: form uses `addressLine`, DB uses `address` — normalize before sending
    const payload = {
      ...data,
      addresses: data.addresses?.map((addr: any) => ({
        ...addr,
        address: addr.addressLine, // map to DB field
      })),
    };

    const actionCall = isEdit
      ? updateSupplier(supplier.id, payload as any)
      : createSupplier(payload as any);

    startTransition(async () => {
      await runActionWithToast(actionCall, {
        successMessage: isEdit ? 'บันทึกการแก้ไขสำเร็จ' : 'เพิ่มผู้จำหน่ายสำเร็จ',
        onSuccess: () => {
          setTimeout(() => {
            router.push('/suppliers');
            router.refresh();
          }, 100);
        },
        onError: (result) => {
          mapActionErrorsToForm(methods, result.errors);
          if (result.message && !result.errors) {
            setError('root', { message: result.message });
          }
        }
      });
    });
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20">
        {methods.formState.errors.root && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {methods.formState.errors.root.message}
          </div>
        )}

        <div className="grid gap-8">
          <Card>
            <CardContent className="pt-6">
              <SafeBoundary variant="compact" componentName="SupplierIdentity">
                <PartnerIdentitySection type="SUPPLIER" />
              </SafeBoundary>
            </CardContent>
          </Card>

          <SafeBoundary variant="compact" componentName="SupplierAddress">
            <PartnerAddressSection />
          </SafeBoundary>

          <Card>
            <CardContent className="pt-6">
              <SafeBoundary variant="compact" componentName="SupplierFinancial">
                <PartnerFinancialSection type="SUPPLIER" />
              </SafeBoundary>
            </CardContent>
          </Card>
        </div>

        {/* Rule 7: Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-background/80 backdrop-blur-md border-t p-4 flex items-center justify-end gap-3 z-50">
          <div className="container max-w-5xl flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending} className="px-8 shadow-lg shadow-primary/20">
              {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มผู้จำหน่าย'}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
