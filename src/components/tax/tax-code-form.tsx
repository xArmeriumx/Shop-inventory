'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import {
    taxCodeSchema,
    TaxCodeFormValues,
    getDefaultTaxCodeValues
} from '@/schemas/tax/tax-form.schema';
import { createTaxCode, updateTaxCode } from '@/actions/tax/tax.actions';
import { toast } from 'sonner';
import { runActionWithToast, mapActionErrorsToForm } from '@/lib/mutation-utils';
import { useTransition } from 'react';

interface TaxCodeFormProps {
    initialData?: any;
    onSuccess?: () => void;
}

export function TaxCodeForm({ initialData, onSuccess }: TaxCodeFormProps) {
    const [isPending, startTransition] = useTransition();
    const isEdit = !!initialData;

    const methods = useForm<TaxCodeFormValues>({
        resolver: zodResolver(taxCodeSchema),
        defaultValues: getDefaultTaxCodeValues(initialData),
    });

    const onSubmit = (values: TaxCodeFormValues) => {
        startTransition(async () => {
            const action = isEdit
                ? updateTaxCode(initialData.code, values)
                : createTaxCode(values);

            await runActionWithToast(action, {
                successMessage: isEdit ? 'แก้ไขรหัสภาษีสำเร็จ' : 'สร้างรหัสภาษีใหม่สำเร็จ',
                onSuccess: () => {
                    setTimeout(() => {
                        onSuccess?.();
                    }, 100);
                },
                onError: (result) => {
                    if (result.errors) {
                        mapActionErrorsToForm(methods, result.errors);
                    }
                }
            });
        });
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <FormField name="code" label="รหัสผังภาษี" required hint="เช่น VAT7, EXEMPT">
                        <Input {...methods.register('code')} disabled={isEdit} placeholder="รหัสผังภาษี" />
                    </FormField>
                    <FormField name="name" label="ชื่อรหัสภาษี" required>
                        <Input {...methods.register('name')} placeholder="เช่น ภาษีมูลค่าเพิ่ม 7%" />
                    </FormField>
                </div>

                <FormField name="description" label="คำอธิบาย">
                    <Textarea {...methods.register('description')} placeholder="คำอธิบายเพิ่มเติม..." />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                    <FormField name="direction" label="ทิศทาง" required>
                        <Select
                            value={methods.watch('direction')}
                            onValueChange={(v) => methods.setValue('direction', v as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="เลือกทิศทาง" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OUTPUT">ภาษีขาย (OUTPUT)</SelectItem>
                                <SelectItem value="INPUT">ภาษีซื้อ (INPUT)</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormField>

                    <FormField name="kind" label="ชนิดภาษี" required>
                        <Select
                            value={methods.watch('kind')}
                            onValueChange={(v) => methods.setValue('kind', v as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="เลือกชนิด" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="VAT">VAT (7% หรือตามอัตราปกติ)</SelectItem>
                                <SelectItem value="ZERO_RATED">0% (ส่งออก)</SelectItem>
                                <SelectItem value="EXEMPT">Exempt (ยกเว้นภาษี)</SelectItem>
                                <SelectItem value="NO_VAT">No VAT (ไม่อยู่ในระบบภาษี)</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField name="rate" label="อัตราภาษี (%)" required>
                        <Input
                            type="number"
                            {...methods.register('rate')}
                            placeholder="0.00"
                        />
                    </FormField>

                    <FormField name="calculationMode" label="วิธีคำนวณ" required>
                        <Select
                            value={methods.watch('calculationMode')}
                            onValueChange={(v) => methods.setValue('calculationMode', v as any)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="เลือกวิธีคำนวณ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EXCLUSIVE">Exclusive (บวกเพิ่มจากฐาน)</SelectItem>
                                <SelectItem value="INCLUSIVE">Inclusive (รวมในราคาสินค้า)</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormField>
                </div>

                <div className="flex items-center space-x-2 border p-3 rounded-lg bg-muted/20">
                    <Switch
                        id="isActive"
                        checked={methods.watch('isActive')}
                        onCheckedChange={(checked) => methods.setValue('isActive', checked)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <label
                            htmlFor="isActive"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            เปิดใช้งาน (Active)
                        </label>
                        <p className="text-xs text-muted-foreground">
                            หากปิดใช้งาน รหัสนี้จะไม่ปรากฏให้เลือกในเอกสารใหม่
                        </p>
                    </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                    <Button type="submit" disabled={isPending} className="px-8 shadow-md">
                        {isPending ? 'กำลังบันทึก...' : isEdit ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
}
