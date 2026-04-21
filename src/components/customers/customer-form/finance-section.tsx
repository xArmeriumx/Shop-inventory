'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { CustomerFormValues } from '@/schemas/customer-form';

export function FinanceSection() {
    const { register } = useFormContext<CustomerFormValues>();

    return (
        <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground border-b pb-1 mb-4">
                การเงินและเครดิต (Finance & Credit)
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
                <FormField name="creditLimit" label="วงเงินเครดิต (Credit Limit)" hint="ยอดค้างชำระสูงสุด">
                    <div className="relative">
                        <Input
                            id="creditLimit"
                            type="number"
                            {...register('creditLimit')}
                            placeholder="0.00"
                            className="pl-8"
                        />
                        <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">฿</span>
                    </div>
                </FormField>

                <FormField name="creditTerm" label="ระยะเวลาให้เครดิต (Days)" hint="จำนวนวันครบกำหนดชำระ">
                    <div className="relative">
                        <Input
                            id="creditTerm"
                            type="number"
                            {...register('creditTerm')}
                            placeholder="30"
                            className="pr-12"
                        />
                        <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">วัน</span>
                    </div>
                </FormField>
            </div>

            <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-dashed text-center">
                <p className="text-xs text-muted-foreground">
                    ข้อมูลส่วนนี้จะถูกนำไปใช้ในโมดูล **AR/AP Tracking** (Layer 2)
                    เพื่อคำนวณวันครบกำหนดและประวัติการชำระเงินอัตโนมัติ
                </p>
            </div>
        </div>
    );
}
