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
import { Badge } from '@/components/ui/badge';
import type { GenesisStep2Input } from '@/schemas/core/onboarding.schema';
import { cn } from '@/lib/utils';
import { ShieldAlert, ShieldCheck, FileText, Scale } from 'lucide-react';

export function WizardStep2Legal() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep2Input>();
    const isVatRegistered = watch('isVatRegistered');

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-primary">กฎหมายและภาษี</h2>
                <p className="text-muted-foreground font-medium">
                    ตั้งค่าสถานะภาษีและข้อมูลนิติบุคคลเพื่อความถูกต้องแม่นยำของเอกสาร
                </p>
            </div>

            {/* VAT Toggle — Premium Card */}
            <div className={cn(
                'rounded-3xl border-2 p-6 transition-all duration-300 relative overflow-hidden',
                isVatRegistered
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/5'
                    : 'border-border bg-muted/20',
            )}>
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            'h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm',
                            isVatRegistered ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}>
                            {isVatRegistered
                                ? <ShieldCheck className="h-6 w-6" />
                                : <ShieldAlert className="h-6 w-6" />
                            }
                        </div>
                        <div>
                            <Label htmlFor="vat-toggle" className="text-lg font-black cursor-pointer flex items-center gap-2">
                                จดทะเบียนภาษีมูลค่าเพิ่ม (VAT 7%)
                                {isVatRegistered && <Badge className="bg-primary/20 text-primary border-none text-[10px]">Active</Badge>}
                            </Label>
                            <p className="text-sm text-muted-foreground font-medium">
                                {isVatRegistered
                                    ? 'ระบบจะออกใบกำกับภาษีเต็มรูปแบบอัตโนมัติ'
                                    : 'ระบบจะออกเฉพาะใบเสร็จรับเงิน/ใบวางบิล'}
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="vat-toggle"
                        checked={isVatRegistered}
                        onCheckedChange={(v) => setValue('isVatRegistered', v)}
                        className="scale-125"
                    />
                </div>

                {/* Conditional fields with fluid animation feel */}
                {isVatRegistered && (
                    <div className="mt-6 pt-6 border-t-2 border-primary/10 space-y-6 relative z-10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField name="taxId" label="เลขประจำตัวผู้เสียภาษี" required hint="13 หลัก">
                                <div className="relative group">
                                    <Input
                                        id="taxId"
                                        placeholder="0000000000000"
                                        maxLength={13}
                                        {...register('taxId')}
                                        className={cn("h-12 font-mono text-lg bg-background border-2", errors.taxId && 'border-destructive')}
                                    />
                                    <FileText className="absolute right-3 top-3.5 h-5 w-5 text-muted-foreground/30" />
                                </div>
                            </FormField>

                            <FormField name="branchCode" label="รหัสสาขา" required hint="00000 = สำนักงานใหญ่">
                                <Input
                                    id="branchCode"
                                    placeholder="00000"
                                    maxLength={5}
                                    {...register('branchCode')}
                                    className={cn("h-12 font-mono text-lg bg-background border-2 text-center", errors.branchCode && 'border-destructive')}
                                />
                            </FormField>
                        </div>

                        <FormField name="address" label="ที่อยู่จดทะเบียนตาม ภ.พ.20" required>
                            <Textarea
                                id="address"
                                placeholder="123/4 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110"
                                rows={3}
                                {...register('address')}
                                className={cn('h-24 resize-none bg-background border-2 text-md p-4', errors.address && 'border-destructive')}
                            />
                        </FormField>
                    </div>
                )}
            </div>

            {/* Legal entity name */}
            <FormField
                name="legalEntityName"
                label="ชื่อนิติบุคคลตามกฎหมาย"
                hint="กรณีต่างจากชื่อร้านค้า เช่น บจก. สมชาย (ไทยแลนด์)"
            >
                <div className="relative group">
                    <Input
                        id="legalEntityName"
                        placeholder="บริษัท / ห้างหุ้นส่วน / ชื่อเจ้าของ"
                        {...register('legalEntityName')}
                        className="h-12 pl-10 border-2"
                    />
                    <Scale className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                </div>
            </FormField>

            {!isVatRegistered && (
                <div className="rounded-2xl bg-orange-50 border-2 border-orange-100 p-4 flex gap-3 text-orange-800">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <p className="text-xs font-medium leading-relaxed">
                        <strong>ข้อแนะนำ:</strong> หากคุณไม่ได้จด VAT ระบบจะปิดฟังก์ชันใบกำกับภาษีอัตโนมัติ 
                        แต่คุณยังสามารถเปิดใช้งานได้ภายหลังที่หน้าตั้งค่าระบบ
                    </p>
                </div>
            )}
        </div>
    );
}
