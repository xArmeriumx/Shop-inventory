'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/ui/form-field';
import {
    companyTaxProfileSchema,
    CompanyTaxProfileValues,
    getDefaultCompanyTaxValues
} from '@/schemas/tax-form';
import { upsertCompanyTaxProfile } from '@/actions/tax';
import { toast } from 'sonner';
import { useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface CompanyTaxProfileFormProps {
    initialData?: any;
}

export function CompanyTaxProfileForm({ initialData }: CompanyTaxProfileFormProps) {
    const [isPending, startTransition] = useTransition();

    const methods = useForm<CompanyTaxProfileValues>({
        resolver: zodResolver(companyTaxProfileSchema),
        defaultValues: getDefaultCompanyTaxValues(initialData),
    });

    const onSubmit = (values: CompanyTaxProfileValues) => {
        startTransition(async () => {
            const res = await upsertCompanyTaxProfile(values);
            if (res.success) {
                toast.success(res.message);
            } else {
                toast.error(res.message);
            }
        });
    };

    return (
        <FormProvider {...methods}>
            <form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
                <Card className="border-primary/10 shadow-sm overflow-hidden">
                    <CardHeader className="bg-primary/5">
                        <CardTitle>ข้อมูลผู้เสียภาษี (Company Tax Profile)</CardTitle>
                        <CardDescription>การตั้งค่าตัวตนภาษีของบริษัทสำหรับใช้ในใบกำกับภาษีและรายงาน ภ.พ.30</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/20">
                            <div className="space-y-0.5">
                                <label className="text-base font-semibold">การจดทะเบียน VAT</label>
                                <p className="text-sm text-muted-foreground">บริษัทจดทะเบียนภาษีมูลค่าเพิ่มเข้าระบบแล้วหรือไม่</p>
                            </div>
                            <Switch
                                checked={methods.watch('isVatRegistered')}
                                onCheckedChange={(checked) => methods.setValue('isVatRegistered', checked)}
                            />
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField name="legalName" label="ชื่อจดทะเบียนนิติบุคคล" required hint="ชื่อตามสำเนา ภ.พ.20">
                                <Input {...methods.register('legalName')} placeholder="บริษัท แซมเปิล จำกัด" />
                            </FormField>

                            <FormField name="taxPayerId" label="เลขประจำตัวผู้เสียภาษี" required hint="13 หลัก">
                                <Input {...methods.register('taxPayerId')} placeholder="0123456789012" maxLength={13} />
                            </FormField>

                            <FormField name="branchCode" label="รหัสสาขา" required hint="สำนักงานใหญ่คือ 00000">
                                <Input {...methods.register('branchCode')} placeholder="00000" maxLength={5} />
                            </FormField>

                            <FormField name="registeredAddress" label="ที่อยู่จดทะเบียน" hint="ที่อยู่รวมรหัสไปรษณีย์">
                                <Input {...methods.register('registeredAddress')} placeholder="เลขที่... ถนน... แขวง... เขต... จังหวัด... 10xxx" />
                            </FormField>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-primary uppercase tracking-wider">ผู้ลงนาม (Signatory)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField name="authorizedPerson" label="ชื่อผู้มีอำนาจลงนาม" hint="ชื่อที่ปรากฏในใบกำกับภาษี/50 ทวิ">
                                    <Input {...methods.register('authorizedPerson')} placeholder="นายสมชาย ใจดี" />
                                </FormField>
                                <FormField name="authorizedPosition" label="ตำแหน่ง" hint="ตำแหน่งของผู้ลงนาม">
                                    <Input {...methods.register('authorizedPosition')} placeholder="กรรมการผู้จัดการ" />
                                </FormField>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-medium text-sm text-primary uppercase tracking-wider">ตั้งค่าเริ่มต้น (Defaults)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField name="taxInvoicePrefix" label="Prefix ใบกำกับภาษี">
                                    <Input {...methods.register('taxInvoicePrefix')} placeholder="TIV" />
                                </FormField>
                                <FormField name="creditNotePrefix" label="Prefix ใบลดหนี้">
                                    <Input {...methods.register('creditNotePrefix')} placeholder="CN" />
                                </FormField>
                                <FormField name="debitNotePrefix" label="Prefix ใบเพิ่มหนี้">
                                    <Input {...methods.register('debitNotePrefix')} placeholder="DN" />
                                </FormField>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isPending} className="px-10 h-11 text-base shadow-lg">
                                {isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </FormProvider>
    );
}
