'use client';
/**
 * Step 2: Legal & Tax Setup
 * Fields: isVatRegistered, taxId, branchCode, address, legalEntityName
 * Key: conditional field reveal when VAT is toggled on
 */
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { GenesisStep2Input } from '@/schemas/core/onboarding.schema';
import { cn } from '@/lib/utils';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export function WizardStep2Legal() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep2Input>();
    const isVatRegistered = watch('isVatRegistered');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">ภาษีและข้อมูลกฎหมาย</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    ใช้สำหรับออกใบกำกับภาษีและเอกสารทางกฎหมาย
                </p>
            </div>

            {/* VAT Toggle */}
            <div className={cn(
                'rounded-lg border p-4 transition-all duration-200',
                isVatRegistered
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/20',
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {isVatRegistered
                            ? <ShieldCheck className="h-5 w-5 text-primary" />
                            : <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                        }
                        <div>
                            <Label htmlFor="vat-toggle" className="font-medium cursor-pointer">
                                จดทะเบียนภาษีมูลค่าเพิ่ม (VAT 7%)
                            </Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {isVatRegistered
                                    ? 'ระบบจะออกใบกำกับภาษีและคิด VAT อัตโนมัติ'
                                    : 'ระบบจะออกเฉพาะใบเสร็จรับเงิน (ไม่มี VAT)'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="vat-toggle"
                        checked={isVatRegistered}
                        onCheckedChange={(v) => setValue('isVatRegistered', v)}
                    />
                </div>

                {/* Conditional fields — only when VAT is on */}
                {isVatRegistered && (
                    <div className="mt-4 pt-4 border-t border-primary/20 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" required hint="13 หลัก">
                                <Input
                                    id="taxId"
                                    placeholder="0000000000000"
                                    maxLength={13}
                                    {...register('taxId')}
                                    className={cn(errors.taxId && 'border-destructive')}
                                />
                            </FormField>

                            <FormField name="branchCode" label="รหัสสาขา" required hint="00000 = สำนักงานใหญ่">
                                <Input
                                    id="branchCode"
                                    placeholder="00000"
                                    maxLength={5}
                                    {...register('branchCode')}
                                    className={cn(errors.branchCode && 'border-destructive')}
                                />
                            </FormField>
                        </div>

                        <FormField name="address" label="ที่อยู่จดทะเบียน" required>
                            <Textarea
                                id="address"
                                placeholder="123/4 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                                rows={3}
                                {...register('address')}
                                className={cn('resize-none', errors.address && 'border-destructive')}
                            />
                        </FormField>
                    </div>
                )}
            </div>

            {/* Legal entity name (always optional) */}
            <FormField
                name="legalEntityName"
                label="ชื่อนิติบุคคลตามเอกสาร"
                hint="กรอกหากต่างจากชื่อร้านค้า เช่น บริษัท สมชาย เทรดดิ้ง จำกัด"
            >
                <Input
                    id="legalEntityName"
                    placeholder="บริษัท / ห้างหุ้นส่วน / ชื่อเจ้าของ"
                    {...register('legalEntityName')}
                />
            </FormField>

            {!isVatRegistered && (
                <div className="rounded-md bg-warning/10 border border-warning/20 p-3 text-xs text-warning-foreground">
                    <strong>หมายเหตุ:</strong> หากไม่จดทะเบียน VAT ระบบจะแสดง Banner เตือนบนหน้าออกบิลทุกครั้ง
                    คุณสามารถเปิดใช้ VAT ได้ในภายหลังจากหน้าตั้งค่าร้านค้า
                </div>
            )}
        </div>
    );
}
