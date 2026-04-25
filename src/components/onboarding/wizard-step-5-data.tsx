'use client';
/**
 * Step 5: Starting Data
 * Fields: onboardingMode, importFileUrl
 *
 * IMPORT mode is marked comingSoon=true — visually disabled until ImportService is ready.
 */
import { useFormContext } from 'react-hook-form';
import type { GenesisStep5Input } from '@/schemas/core/onboarding.schema';
import { OnboardingMode } from '@/types/onboarding.types';
import { cn } from '@/lib/utils';
import { FlaskConical, FileSpreadsheet, Rocket, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ── Mode definitions ─────────────────────────────────────────────────────────

const MODES = [
    {
        value: OnboardingMode.DEMO,
        icon: FlaskConical,
        title: 'โหลดข้อมูลทดสอบ',
        desc: 'สร้างสินค้า 5 รายการ, ลูกค้า 3 ราย, Supplier 1 ราย ทุกรายการมีป้ายกำกับ [DEMO] และลบออกได้ทีหลัง',
        badge: 'แนะนำสำหรับมือใหม่',
        comingSoon: false,
    },
    {
        value: OnboardingMode.IMPORT,
        icon: FileSpreadsheet,
        title: 'นำเข้าจาก Excel / CSV',
        desc: 'อัปโหลดไฟล์สินค้าและลูกค้าโดยตรง — กำลังพัฒนาฟีเจอร์นี้',
        badge: 'เร็วๆ นี้',
        comingSoon: true,
    },
    {
        value: OnboardingMode.EMPTY,
        icon: Rocket,
        title: 'เริ่มต้นว่างเปล่า',
        desc: 'ไม่มีข้อมูลตัวอย่าง ตั้งค่าทุกอย่างเองทั้งหมด',
        badge: null,
        comingSoon: false,
    },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function WizardStep5Data() {
    const { watch, setValue } = useFormContext<GenesisStep5Input>();
    const selectedMode = watch('onboardingMode');

    return (
        <div className="space-y-8">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-primary">ชุดข้อมูลเริ่มต้น</h2>
                <p className="text-muted-foreground font-medium">
                    เลือกวิธีเริ่มต้นระบบของคุณ — ปรับเปลี่ยนได้เสมอภายหลัง
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {MODES.map(({ value, icon: Icon, title, desc, badge, comingSoon }) => {
                    const isSelected = selectedMode === value && !comingSoon;

                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={comingSoon}
                            onClick={() => !comingSoon && setValue('onboardingMode', value)}
                            className={cn(
                                'w-full text-left rounded-3xl border-2 p-6 transition-all duration-300 relative overflow-hidden group',
                                comingSoon && 'opacity-50 grayscale cursor-not-allowed',
                                !comingSoon && isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xl shadow-primary/5'
                                    : !comingSoon
                                        ? 'border-border bg-card/40 hover:border-primary/40 hover:bg-card shadow-sm'
                                        : 'border-border bg-muted/10',
                            )}
                        >
                            <div className="flex items-start gap-6 relative z-10">
                                {/* Icon */}
                                <div className={cn(
                                    'h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 border-2 shadow-sm transition-all',
                                    isSelected ? 'bg-primary text-primary-foreground border-primary/20 scale-110' : 'bg-muted text-muted-foreground border-transparent',
                                )}>
                                    <Icon className="h-7 w-7" />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <p className="text-lg font-black">{title}</p>
                                        {badge && (
                                            <Badge className={cn(
                                                'text-[10px] font-bold px-2 py-0.5 border-none',
                                                comingSoon
                                                    ? 'bg-muted text-muted-foreground'
                                                    : 'bg-primary/20 text-primary',
                                            )}>
                                                {badge}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground font-medium mt-1 leading-relaxed">{desc}</p>
                                </div>

                                {/* Selection indicator */}
                                {!comingSoon && (
                                    <div className={cn(
                                        'h-6 w-6 rounded-full border-4 flex items-center justify-center shrink-0 mt-1.5 transition-all',
                                        isSelected ? 'border-primary' : 'border-muted-foreground/20',
                                    )}>
                                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                                    </div>
                                )}
                            </div>
                            
                            {/* Decorative element */}
                            {isSelected && (
                                <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Final Call to Action guidance */}
            <div className="rounded-3xl bg-primary/5 border-2 border-primary/10 p-6 flex items-center gap-4">
                <div className="h-10 w-10 min-w-[40px] rounded-full bg-primary/20 flex items-center justify-center text-primary shadow-sm">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                   <p className="text-xs font-black text-primary uppercase tracking-widest leading-none mb-1">ยินดีด้วย! คุณพร้อมสร้างกิจการแล้ว</p>
                   <p className="text-[11px] text-muted-foreground font-medium">กดปุ่มสีดำด้านล่างเพื่อเริ่มการเดินทางในโลก ERP ของคุณ ระบบจะตั้งค่าทุกอย่างให้ภายในไม่กี่วินาที</p>
                </div>
            </div>
        </div>
    );
}
