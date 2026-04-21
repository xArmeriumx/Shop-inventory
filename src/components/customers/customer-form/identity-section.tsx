'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { CustomerFormValues } from '@/schemas/customer-form';

export function IdentitySection() {
    const { register } = useFormContext<CustomerFormValues>();

    return (
        <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground border-b pb-1 mb-4">
                ข้อมูลพื้นฐาน (Basic Identity)
            </div>

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

                <div className="grid grid-cols-2 gap-4 sm:col-span-2">
                    <FormField name="groupCode" label="กลุ่มลูกค้า" hint="Industrial / Retail">
                        <Input id="groupCode" {...register('groupCode')} placeholder="รหัสกลุ่มลูกค้า" />
                    </FormField>
                    <FormField name="region" label="พื้นที่ / ภูมิภาค">
                        <Input id="region" {...register('region')} placeholder="เช่น กรงุเทพฯ / ภาคเหนือ" />
                    </FormField>
                </div>
            </div>
        </div>
    );
}
