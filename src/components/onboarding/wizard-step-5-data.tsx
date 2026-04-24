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
import { FlaskConical, FileSpreadsheet, Rocket } from 'lucide-react';

// ── Mode definitions — comingSoon disables click + dims card ─────────────────

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
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold tracking-tight">ข้อมูลเริ่มต้น</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    เลือกวิธีเริ่มต้นระบบของคุณ — ปรับเปลี่ยนได้ทุกเมื่อ
                </p>
            </div>

            <div className="space-y-3">
                {MODES.map(({ value, icon: Icon, title, desc, badge, comingSoon }) => {
                    const isSelected = selectedMode === value && !comingSoon;

                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={comingSoon}
                            onClick={() => !comingSoon && setValue('onboardingMode', value)}
                            className={cn(
                                'w-full text-left rounded-lg border p-4 transition-all duration-150',
                                comingSoon && 'opacity-50 cursor-not-allowed',
                                !comingSoon && isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : !comingSoon
                                        ? 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                                        : 'border-border',
                            )}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon */}
                                <div className={cn(
                                    'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">{title}</p>
                                        {badge && (
                                            <span className={cn(
                                                'text-[10px] px-2 py-0.5 rounded-full font-medium',
                                                comingSoon
                                                    ? 'bg-muted text-muted-foreground'         // grey = unavailable
                                                    : 'bg-primary/10 text-primary',            // primary = highlight
                                            )}>
                                                {badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                                </div>

                                {/* Radio indicator — hidden for coming-soon items */}
                                {!comingSoon && (
                                    <div className={cn(
                                        'h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                                        isSelected ? 'border-primary' : 'border-muted-foreground/30',
                                    )}>
                                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Summary block */}
            <div className="rounded-lg bg-muted/50 border p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    คลิก &ldquo;เริ่มใช้งาน&rdquo; เพื่อสร้างร้านค้า
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    ระบบจะสร้างร้านค้า, ตั้งค่าสิทธิ์, และเตรียมบัญชีเริ่มต้นในขั้นตอนเดียวอัตโนมัติ
                </p>
            </div>
        </div>
    );
}
