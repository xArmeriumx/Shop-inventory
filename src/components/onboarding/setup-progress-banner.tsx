'use client';

import React, { useState } from 'react';
import { Rocket, X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface SetupProgressBannerProps {
    progressPercent: number;
    completedItems: number;
    totalItems: number;
    nextStepLabel?: string;
    nextStepHref?: string;
}

export function SetupProgressBanner({
    progressPercent,
    completedItems,
    totalItems,
    nextStepLabel,
    nextStepHref,
}: SetupProgressBannerProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className={cn(
            "relative group overflow-hidden rounded-2xl border bg-card p-4 transition-all hover:shadow-md mb-6",
            "bg-gradient-to-r from-background to-primary/5 border-primary/10"
        )}>
            {/* Background Accent */}
            <div className="absolute right-0 top-0 h-full w-1/3 bg-primary/5 [mask-image:linear-gradient(to_left,black,transparent)] pointer-events-none" />

            <div className="relative flex flex-col md:flex-row items-center gap-4 md:gap-8">
                {/* Stats & Title */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary animate-pulse-slow">
                        <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold">เตรียมร้านค้าให้พร้อม (Go-Live)</h3>
                        <p className="text-xs text-muted-foreground">
                            เสร็จสมบูรณ์ {completedItems} จาก {totalItems} รายการ ({progressPercent}%)
                        </p>
                    </div>
                </div>

                {/* Progress Bar (Integrated) */}
                <div className="flex-1 w-full max-w-md">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">System Readiness</span>
                        <span className="text-[10px] font-bold">{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden border border-primary/5">
                        <div
                            className="h-full bg-primary transition-all duration-1000 ease-in-out shadow-[0_0_8px_rgba(var(--primary),0.3)]"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {nextStepLabel && nextStepHref && (
                        <Button variant="outline" size="sm" className="hidden sm:flex h-9 rounded-xl gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-all" asChild>
                            <Link href={nextStepHref}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>{nextStepLabel}</span>
                            </Link>
                        </Button>
                    )}
                    <Button size="sm" className="h-9 rounded-xl gap-2 bg-foreground text-background hover:bg-foreground/90 shadow-sm" asChild>
                        <Link href="/settings/onboarding">
                            <span>ไปที่ Onboarding Hub</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    </Button>

                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors ml-2"
                        title="ปิดชั่วคราว"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
