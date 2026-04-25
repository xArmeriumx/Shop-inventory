'use client';
/**
 * Step 4: Team & Roles
 * Fields: roleTemplate, inviteEmail
 */
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import type { GenesisStep4Input } from '@/schemas/core/onboarding.schema';
import { RoleTemplate } from '@/types/onboarding.types';
import { cn } from '@/lib/utils';
import { User, Users, Settings2, CheckCircle2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const TEMPLATES = [
    {
        value: RoleTemplate.SOLO,
        icon: User,
        title: 'ธุรกิจครอบครัว',
        desc: 'เหมาะสำหรับเจ้าของคนเดียวหรือคนในครอบครัว ไม่จำเป็นต้องตั้งสิทธิ์ซับซ้อน',
        roles: ['Owner (สิทธิ์ทั้งหมด)'],
    },
    {
        value: RoleTemplate.TEAM,
        icon: Users,
        title: 'ออฟฟิศทีม',
        desc: 'สำหรับบริษัทที่มีพนักงานหลายตำแหน่ง ระบบจะสร้าง Role สำเร็จรูปให้',
        roles: ['ผู้จัดการ', 'พนักงานขาย', 'พนักงานสต็อก'],
    },
    {
        value: RoleTemplate.SKIP,
        icon: Settings2,
        title: 'กำหนดเอง',
        desc: 'ข้ามไปก่อน และตั้งค่า Role เองในภายหลังจาก Settings → บทบาท',
        roles: [],
    },
] as const;

export function WizardStep4Team() {
    const { register, watch, setValue, formState: { errors } } = useFormContext<GenesisStep4Input>();
    const selectedTemplate = watch('roleTemplate');

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-primary">ทีมงานและการเข้าถึง</h2>
                <p className="text-muted-foreground font-medium">
                    ออกแบบโครงสร้างองค์กรเบื้องต้นเพื่อกระจายงานได้อย่างปลอดภัย
                </p>
            </div>

            {/* Role template selector */}
            <div className="grid gap-3">
                {TEMPLATES.map(({ value, icon: Icon, title, desc, roles }) => {
                    const isSelected = selectedTemplate === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setValue('roleTemplate', value, { shouldValidate: true })}
                            className={cn(
                                'w-full text-left rounded-3xl border-2 p-5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2',
                                isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-lg shadow-primary/5'
                                    : 'border-border bg-card/40 hover:border-primary/40 hover:bg-card',
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    'h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border',
                                    isSelected ? 'bg-primary text-primary-foreground border-primary/20' : 'bg-muted text-muted-foreground',
                                )}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-black">{title}</p>
                                    <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-relaxed">{desc}</p>
                                    {roles.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-3">
                                            {roles.map((r) => (
                                                <Badge key={r} variant="secondary" className="text-[10px] bg-muted px-2.5 py-0.5 rounded-xl font-bold border-none">
                                                    {r}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {isSelected && (
                                    <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Optional: invite first member */}
            <div className="group rounded-3xl border-2 border-dashed p-6 space-y-4 bg-muted/20 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Users className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-black">เชิญสมาชิกคนแรกเข้าร่วมทีม <span className="text-muted-foreground/60 font-medium">(ไม่บังคับ)</span></p>
                </div>
                
                <FormField name="inviteEmail" label="" hint="ระบบจะส่งอีเมลคำเชิญพนักงานทันทีหลังจากสร้างร้านค้าสำเร็จ">
                    <div className="relative">
                        <Input
                            id="inviteEmail"
                            type="email"
                            placeholder="colleague@company.com"
                            {...register('inviteEmail')}
                            className={cn("h-12 pl-10 font-bold bg-background border-2 rounded-2xl", errors.inviteEmail && 'border-destructive')}
                        />
                        <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary" />
                    </div>
                </FormField>
            </div>
        </div>
    );
}
