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
import { User, Users, Settings2 } from 'lucide-react';

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
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">ทีมงานและสิทธิ์</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    เลือกรูปแบบสิทธิ์ที่เหมาะกับธุรกิจ — เปลี่ยนแปลงได้ทีหลัง
                </p>
            </div>

            {/* Role template selector */}
            <div className="space-y-2">
                {TEMPLATES.map(({ value, icon: Icon, title, desc, roles }) => {
                    const isSelected = selectedTemplate === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setValue('roleTemplate', value, { shouldValidate: true })}
                            className={cn(
                                'w-full text-left rounded-lg border p-4 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2',
                                isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30',
                            )}
                        >
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    'h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                                    isSelected ? 'bg-primary/10' : 'bg-muted',
                                )}>
                                    <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                                    {roles.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {roles.map((r) => (
                                                <span key={r} className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Optional: invite first member */}
            <div className="rounded-lg border border-dashed p-4 space-y-2">
                <p className="text-sm font-medium">เชิญสมาชิกคนแรก <span className="text-muted-foreground font-normal">(ไม่บังคับ)</span></p>
                <FormField name="inviteEmail" label="" hint="ส่งคำเชิญทางอีเมลทันทีหลังสร้างร้านค้า">
                    <Input
                        id="inviteEmail"
                        type="email"
                        placeholder="colleague@company.com"
                        {...register('inviteEmail')}
                        className={cn(errors.inviteEmail && 'border-destructive')}
                    />
                </FormField>
            </div>
        </div>
    );
}
