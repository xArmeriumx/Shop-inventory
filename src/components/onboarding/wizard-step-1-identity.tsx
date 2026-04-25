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
import { Store, ShoppingBag, Factory, Utensils, Briefcase, HelpCircle, Phone, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const INDUSTRY_ICONS: Record<IndustryType, any> = {
    [IndustryType.RETAIL]: ShoppingBag,
    [IndustryType.WHOLESALE]: Store,
    [IndustryType.MANUFACTURE]: Factory,
    [IndustryType.FOOD]: Utensils,
    [IndustryType.SERVICE]: Briefcase,
    [IndustryType.OTHER]: HelpCircle,
};

export function WizardStep1Identity() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep1Input>();
    const selectedIndustry = watch('industryType');

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-primary">ตัวตนของธุรกิจ</h2>
                <p className="text-muted-foreground font-medium">
                    บอกเราซักนิดว่าคุณทำธุรกิจประเภทไหน เพื่อให้เราเตรียมระบบให้เหมาะกับคุณที่สุด
                </p>
            </div>

            {/* Shop Name */}
            <FormField name="name" label="ชื่อร้านค้า / แบรนด์ของคุณ" required hint="ชื่อนี้จะปรากฏบนบิลและใบกำกับภาษี">
                <div className="relative group">
                    <Input
                        id="name"
                        placeholder="เช่น สมชาย ผลิตภัณฑ์ไทย"
                        {...register('name')}
                        className={cn("h-14 pl-12 text-lg font-bold bg-muted/20 focus-visible:bg-background transition-all border-2", errors.name && 'border-destructive')}
                    />
                    <Building2 className="absolute left-4 top-4 h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
            </FormField>

            {/* Industry selector — Premium Grid */}
            <div className="space-y-4">
                <label className="text-sm font-black uppercase tracking-widest text-muted-foreground">ประเภทกิจการของคุณ</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.values(IndustryType).map((type) => {
                        const Icon = INDUSTRY_ICONS[type];
                        const preset = INDUSTRY_PRESETS[type];
                        const isSelected = selectedIndustry === type;

                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setValue('industryType', type, { shouldValidate: true })}
                                className={cn(
                                    'group relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all duration-300',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/10 scale-[1.02]'
                                        : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                                )}
                            >
                                <div className={cn(
                                    'h-12 w-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110',
                                    isSelected ? 'bg-primary-foreground/10' : 'bg-muted text-muted-foreground'
                                )}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <span className="text-sm font-black">{preset.label}</span>
                                {isSelected && (
                                    <Badge variant="secondary" className="absolute -top-2 -right-1 bg-background text-primary border-primary/20 text-[9px] font-bold shadow-sm">Selected</Badge>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Phone */}
            <FormField name="phone" label="เบอร์โทรศัพท์ติดต่อ" required>
                <div className="relative group">
                    <Input
                        id="phone"
                        placeholder="081-XXX-XXXX"
                        {...register('phone')}
                        className={cn("h-12 pl-10 border-2", errors.phone && 'border-destructive')}
                    />
                    <Phone className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
            </FormField>

            <div className="rounded-2xl bg-primary/5 p-4 flex gap-3 border border-primary/10">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Briefcase className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong>คำแนะนำจากระบบ:</strong> เมื่อเลือกประเภทธุรกิจแล้ว ระบบจะทำการสร้างผังบัญชี (Chart of Accounts) 
                    และหมวดหมู่สินค้าเริ่มต้นที่เหมาะสมให้คุณโดยอัตโนมัติ เพื่อให้คุณพร้อมขายได้ภายใน 10 นาที
                </p>
            </div>
        </div>
    );
}
