'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';

interface PartnerFinancialSectionProps {
    type: 'CUSTOMER' | 'SUPPLIER';
}

export function PartnerFinancialSection({ type }: PartnerFinancialSectionProps) {
    const { register } = useFormContext();

    return (
        <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>ข้อมูลเครดิตและการเงิน</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField name="creditLimit" label="วงเงินเครดิต" hint="บาท">
                    <Input
                        id="creditLimit"
                        type="number"
                        {...register('creditLimit')}
                        placeholder="0.00"
                        step="1000"
                    />
                </FormField>

                <FormField name="creditTerm" label="ระยะเวลาเครดิต (เทอม)" hint="วัน">
                    <Input
                        id="creditTerm"
                        type="number"
                        {...register('creditTerm')}
                        placeholder="30"
                    />
                </FormField>

                {type === 'SUPPLIER' && (
                    <>
                        <FormField name="moq" label="จำนวนสั่งซื้อขั้นต่ำ (MOQ)">
                            <Input id="moq" type="number" {...register('moq')} placeholder="0" />
                        </FormField>
                        <FormField name="paymentTerms" label="เงื่อนไขการชำระเงิน" className="sm:col-span-2">
                            <textarea
                                id="paymentTerms"
                                {...register('paymentTerms')}
                                placeholder="เช่น โอนล่วงหน้า, บัตรเครดิต, เช็ค"
                                rows={2}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </FormField>
                    </>
                )}
            </div>
        </div>
    );
}
