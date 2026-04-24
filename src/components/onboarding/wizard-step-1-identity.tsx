'use client';
/**
 * Step 1: Business Identity
 * Fields: name, industryType, phone, logo
 */
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { GenesisStep1Input } from '@/schemas/core/onboarding.schema';
import { IndustryType, INDUSTRY_PRESETS } from '@/types/onboarding.types';
import { cn } from '@/lib/utils';

export function WizardStep1Identity() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep1Input>();
    const selectedIndustry = watch('industryType');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">ตัวตนธุรกิจของคุณ</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    ข้อมูลเหล่านี้จะปรากฏบนเอกสารทุกชนิดของคุณ
                </p>
            </div>

            {/* Shop name */}
            <FormField name="name" label="ชื่อกิจการ" required>
                <Input
                    id="name"
                    placeholder="เช่น ห้างหุ้นส่วน สมชาย เทรดดิ้ง"
                    {...register('name')}
                    className={cn(errors.name && 'border-destructive')}
                />
            </FormField>

            {/* Industry type */}
            <div className="space-y-2">
                <label className="text-[13px] font-medium">
                    ประเภทธุรกิจ <span className="text-destructive">*</span>
                </label>
                <p className="text-xs text-muted-foreground -mt-1 mb-2">
                    ระบบจะตั้งค่าหมวดหมู่สินค้าให้อัตโนมัติ
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.values(IndustryType) as string[]).map((type) => {
                        const preset = INDUSTRY_PRESETS[type as keyof typeof INDUSTRY_PRESETS];
                        const isSelected = selectedIndustry === type;
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setValue('industryType', type as GenesisStep1Input['industryType'], { shouldValidate: true })}
                                className={cn(
                                    'text-left rounded-lg border p-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2',
                                    isSelected
                                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                        : 'border-border hover:border-muted-foreground/40 hover:bg-muted/40',
                                )}
                            >
                                <p className="text-xs font-medium">{preset.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                    {preset.description}
                                </p>
                            </button>
                        );
                    })}
                </div>
                {errors.industryType && (
                    <p className="text-xs text-destructive">{errors.industryType.message}</p>
                )}
            </div>

            {/* Phone */}
            <FormField name="phone" label="เบอร์โทรศัพท์" required hint="10 หลัก ใช้แสดงบนใบเสร็จ">
                <Input
                    id="phone"
                    type="tel"
                    placeholder="0812345678"
                    maxLength={10}
                    {...register('phone')}
                    className={cn(errors.phone && 'border-destructive')}
                />
            </FormField>
        </div>
    );
}
