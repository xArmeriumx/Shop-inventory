'use client';

import { useFormContext } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { CustomerFormValues } from '@/schemas/customer-form';

export function LogisticsSection() {
    const { register, watch, setValue } = useFormContext<CustomerFormValues>();
    const sameAsShipping = watch('sameAsShipping');

    return (
        <div className="space-y-6">
            <div className="text-sm font-medium text-muted-foreground border-b pb-1">
                การจัดส่งและที่อยู่ (Logistics & Addresses)
            </div>

            <div className="space-y-4">
                <FormField name="shippingAddress" label="ที่อยู่จัดส่ง (Shipping Address)" required>
                    <textarea
                        id="shippingAddress"
                        {...register('shippingAddress')}
                        placeholder="ที่อยู่สำหรับจัดส่งสินค้า"
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </FormField>

                <div className="flex items-center space-x-2 py-2">
                    <Switch
                        id="sameAsShipping"
                        checked={sameAsShipping}
                        onCheckedChange={(checked) => {
                            setValue('sameAsShipping', checked);
                            if (checked) {
                                setValue('billingAddress', watch('shippingAddress'));
                            }
                        }}
                    />
                    <Label htmlFor="sameAsShipping">ที่อยู่แจ้งหนี้เหมือนที่อยู่จัดส่ง</Label>
                </div>

                {!sameAsShipping && (
                    <FormField name="billingAddress" label="ที่อยู่ใบแจ้งหนี้ (Billing Address)" required>
                        <textarea
                            id="billingAddress"
                            {...register('billingAddress')}
                            placeholder="ที่อยู่สำหรับออกใบแจ้งหนี้/ใบกำกับภาษี"
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                    </FormField>
                )}

                <FormField name="notes" label="หมายเหตุ (Notes)">
                    <textarea
                        id="notes"
                        {...register('notes')}
                        placeholder="บันทึกเพิ่มเติมเกี่ยวกับลูกค้ารายนี้"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </FormField>
            </div>
        </div>
    );
}
