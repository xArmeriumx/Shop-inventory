'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';

interface PartnerIdentitySectionProps {
    type: 'CUSTOMER' | 'SUPPLIER';
}

export function PartnerIdentitySection({ type }: PartnerIdentitySectionProps) {
    const { register } = useFormContext();

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2">
                {type === 'CUSTOMER' ? 'ข้อมูลลูกค้า' : 'ข้อมูลผู้จำหน่าย'}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="name" label={type === 'CUSTOMER' ? "ชื่อลูกค้า" : "ชื่อผู้จำหน่าย"} required className="sm:col-span-2">
                    <Input
                        id="name"
                        {...register('name')}
                        placeholder={type === 'CUSTOMER' ? "ชื่อ-นามสกุล หรือชื่อบริษัท" : "ชื่อบริษัท หรือชื่อผู้จำหน่าย"}
                        maxLength={200}
                    />
                </FormField>

                {type === 'SUPPLIER' && (
                    <FormField name="code" label="รหัสผู้จำหน่าย" hint="เช่น SUP001">
                        <Input id="code" {...register('code')} placeholder="SUP001" maxLength={50} />
                    </FormField>
                )}

                <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" hint="เลข 13 หลัก">
                    <Input id="taxId" {...register('taxId')} placeholder="เลข 13 หลัก" maxLength={13} inputMode="numeric" />
                </FormField>

                <FormField name="email" label="อีเมล" className="sm:col-span-2">
                    <Input id="email" type="email" {...register('email')} placeholder="email@example.com" maxLength={254} />
                </FormField>

                        <FormField name="groupCode" label="รหัสกลุ่มลูกค้า" className="sm:col-span-2">
                            <Input id="groupCode" {...register('groupCode')} placeholder="เช่น G01" />
                        </FormField>

                <FormField name="notes" label="หมายเหตุ" className="sm:col-span-2">
                    <textarea
                        id="notes"
                        {...register('notes')}
                        placeholder="บันทึกเพิ่มเติมสำหรับพาร์ทเนอร์รายนี้"
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                </FormField>
            </div>
        </div>
    );
}
