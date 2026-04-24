'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SafeBoundary } from '@/components/ui/safe-boundary';

import { createCustomer, updateCustomer } from '@/actions/sales/customers.actions';
import { customerFormSchema, getCustomerFormDefaults } from '@/schemas/sales/customer-form.schema';
import type { CustomerFormValues } from '@/schemas/sales/customer-form.schema';

import { PartnerIdentitySection } from '@/components/shared/partners/partner-identity-section';
import { PartnerFinancialSection } from '@/components/shared/partners/partner-financial-section';
import { PartnerAddressSection } from '@/components/shared/partners/partner-address-section';

interface CustomerFormProps {
    customer?: any; // SerializedCustomer
}

export function CustomerForm({ customer }: CustomerFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const isEdit = !!customer;

    const methods = useForm<CustomerFormValues>({
        resolver: zodResolver(customerFormSchema),
        defaultValues: getCustomerFormDefaults(customer),
    });

    const { handleSubmit, setError } = methods;

    async function onSubmit(data: CustomerFormValues) {
        startTransition(async () => {
            const result = isEdit
                ? await updateCustomer(customer.id, data as any)
                : await createCustomer(data as any);

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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-20">
                {methods.formState.errors.root && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {methods.formState.errors.root.message}
                    </div>
                )}

                <div className="grid gap-8">
                    <Card>
                        <CardContent className="pt-6">
                            <SafeBoundary variant="compact" componentName="CustomerIdentity">
                                <PartnerIdentitySection type="CUSTOMER" />
                            </SafeBoundary>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <SafeBoundary variant="compact" componentName="CustomerFinancial">
                                <PartnerFinancialSection type="CUSTOMER" />
                            </SafeBoundary>
                        </CardContent>
                    </Card>

                    <SafeBoundary variant="compact" componentName="CustomerAddress">
                        <PartnerAddressSection />
                    </SafeBoundary>
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
                            {isPending ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า'}
                        </Button>
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}
