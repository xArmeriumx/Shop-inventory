'use client';

import React, { useState, useEffect } from 'react';
import { SpotlightPopover } from '@/components/ui/spotlight-popover';
import { updateTutorialProgress, dismissTutorial } from '@/actions/core/onboarding.actions';
import { useRouter } from 'next/navigation';

interface TutorialStep {
    targetId: string;
    title: string;
    content: string;
    href?: string;
}

const TRACK_1_STEPS: TutorialStep[] = [
    {
        targetId: 'sidebar-products',
        title: 'เพิ่มสินค้าชิ้นแรก',
        content: 'เริ่มจากการกดเมนู "สินค้า" เพื่อเพิ่มข้อมูลสิ่งของที่เราต้องการขาย พร้อมราคาทุนและราคาขาย',
        href: '/products',
    },
    {
        targetId: 'sidebar-customers',
        title: 'จัดการข้อมูลลูกค้า',
        content: 'เพิ่มรายชื่อลูกค้าประจำ เพื่อใช้สำหรับเก็บประวัติการซื้อและให้ส่วนลดพิเศษในภายหลัง',
        href: '/customers',
    },
    {
        targetId: 'sidebar-sales',
        title: 'ลองเปิดการขาย',
        content: 'เมื่อมีสินค้าและลูกค้าแล้ว ลองกดเมนู "ขายสินค้า" เพื่อบันทึกออเดอร์แรกของคุณ',
        href: '/sales',
    },
    {
        targetId: 'sidebar-dashboard',
        title: 'ดูผลกำไรที่ Dashboard',
        content: 'ทุกการขายจะถูกนำมาวิเคราะห์กำไรและยอดขายแสดงผลแบบ Real-time ที่หน้า Dashboard นี้',
        href: '/dashboard',
    },
];

interface TutorialManagerProps {
    initialTrack: number;
    initialStep: number;
    isDismissed: boolean;
}

export function TutorialManager({ initialTrack, initialStep, isDismissed }: TutorialManagerProps) {
    const [step, setStep] = useState(initialStep);
    const [active, setActive] = useState(!isDismissed && initialTrack === 1);
    const router = useRouter();

    useEffect(() => {
        // If we have an href for the current step, we should be on that page
        const currentStepData = TRACK_1_STEPS[step - 1];
        if (active && currentStepData?.href && !window.location.pathname.startsWith(currentStepData.href)) {
            // We don't auto-redirect here to avoid jarring UX, 
            // but the spotlight will show contextually if the user is on the right page.
        }
    }, [active, step]);

    if (!active) return null;

    const currentStepData = TRACK_1_STEPS[step - 1];
    if (!currentStepData) return null;

    const handleNext = async () => {
        if (step < TRACK_1_STEPS.length) {
            const nextStep = step + 1;
            setStep(nextStep);
            await updateTutorialProgress(1, nextStep);

            const nextData = TRACK_1_STEPS[nextStep - 1];
            if (nextData?.href) {
                router.push(nextData.href);
            }
        } else {
            setActive(false);
            await dismissTutorial();
        }
    };

    const handleClose = async () => {
        setActive(false);
        await dismissTutorial();
    };

    return (
        <SpotlightPopover
            targetId={currentStepData.targetId}
            title={currentStepData.title}
            content={currentStepData.content}
            step={step}
            totalSteps={TRACK_1_STEPS.length}
            onNext={handleNext}
            onClose={handleClose}
        />
    );
}
