/**
 * ============================================================================
 * GenesisWizard — Main Orchestrator (Phase OB1)
 * ============================================================================
 * Renders a 5-step progressive wizard for creating a new Shop.
 * Uses React Hook Form (FormProvider) with Zod validation per step.
 *
 * Design rules (per Phase 3 Standard):
 * - FormProvider wraps all steps; each step uses useFormContext
 * - Autosave draft after each step via saveOnboardingDraft()
 * - Server-side re-validation happens inside completeGenesis()
 * - No business logic here — only UI orchestration
 */
'use client';

import { useState, useTransition } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { runActionWithToast } from '@/lib/mutation-utils';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

import {
    genesisStep1Schema, getStep1Defaults,
    genesisStep2Schema, getStep2Defaults,
    genesisStep3Schema, getStep3Defaults,
    genesisStep4Schema, getStep4Defaults,
    genesisStep5Schema, getStep5Defaults,
    type GenesisStep1Input,
    type GenesisStep2Input,
    type GenesisStep3Input,
    type GenesisStep4Input,
    type GenesisStep5Input,
} from '@/schemas/core/onboarding.schema';
import { completeGenesis, saveOnboardingDraft } from '@/actions/core/onboarding.actions';

import { WizardStep1Identity } from './wizard-step-1-identity';
import { WizardStep2Legal } from './wizard-step-2-legal';
import { WizardStep3Financial } from './wizard-step-3-financial';
import { WizardStep4Team } from './wizard-step-4-team';
import { WizardStep5Data } from './wizard-step-5-data';

// ============================================================================
// Step meta — single source of truth for stepper display
// ============================================================================

const STEPS = [
    { id: 1, label: 'ตัวตนธุรกิจ', short: 'Identity' },
    { id: 2, label: 'ภาษีและกฎหมาย', short: 'Legal' },
    { id: 3, label: 'การเงิน', short: 'Financial' },
    { id: 4, label: 'ทีมงาน', short: 'Team' },
    { id: 5, label: 'ข้อมูลเริ่มต้น', short: 'Data' },
] as const;

// ============================================================================
// Draft persistence helper
// ============================================================================

async function autosave(step: number, data: Record<string, unknown>) {
    try {
        await saveOnboardingDraft(step, data);
    } catch {
        // Autosave failure is non-fatal — wizard still proceeds
    }
}

// ============================================================================
// Component
// ============================================================================

export function GenesisWizard() {
    const [currentStep, setCurrentStep] = useState(1);
    const [isPending, startTransition] = useTransition();
    const { update } = useSession();

    // Collect each step's validated data in state before final submit
    const [step1Data, setStep1Data] = useState<GenesisStep1Input>(getStep1Defaults());
    const [step2Data, setStep2Data] = useState<GenesisStep2Input>(getStep2Defaults());
    const [step3Data, setStep3Data] = useState<GenesisStep3Input>(getStep3Defaults());
    const [step4Data, setStep4Data] = useState<GenesisStep4Input>(getStep4Defaults());

    // ── Per-step forms ───────────────────────────────────────────────────────
    const form1 = useForm<GenesisStep1Input>({ resolver: zodResolver(genesisStep1Schema), defaultValues: getStep1Defaults() });
    const form2 = useForm<GenesisStep2Input>({ resolver: zodResolver(genesisStep2Schema), defaultValues: getStep2Defaults() });
    const form3 = useForm<GenesisStep3Input>({ resolver: zodResolver(genesisStep3Schema), defaultValues: getStep3Defaults() });
    const form4 = useForm<GenesisStep4Input>({ resolver: zodResolver(genesisStep4Schema), defaultValues: getStep4Defaults() });
    const form5 = useForm<GenesisStep5Input>({ resolver: zodResolver(genesisStep5Schema), defaultValues: getStep5Defaults() });

    // ── Navigate forward ──────────────────────────────────────────────────────
    const handleNext = async () => {
        let isValid = false;

        if (currentStep === 1) {
            isValid = await form1.trigger();
            if (isValid) {
                const data = form1.getValues();
                setStep1Data(data);
                await autosave(1, data as unknown as Record<string, unknown>);
            }
        } else if (currentStep === 2) {
            isValid = await form2.trigger();
            if (isValid) {
                const data = form2.getValues();
                setStep2Data(data);
                await autosave(2, data as unknown as Record<string, unknown>);
            }
        } else if (currentStep === 3) {
            isValid = await form3.trigger();
            if (isValid) {
                const data = form3.getValues();
                setStep3Data(data);
                await autosave(3, data as unknown as Record<string, unknown>);
            }
        } else if (currentStep === 4) {
            isValid = await form4.trigger();
            if (isValid) {
                const data = form4.getValues();
                setStep4Data(data);
                await autosave(4, data as unknown as Record<string, unknown>);
            }
        }

        if (isValid) setCurrentStep((s) => Math.min(s + 1, 5));
    };

    // ── Navigate back ─────────────────────────────────────────────────────────
    const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

    // ── Final submission ──────────────────────────────────────────────────────
    const handleSubmit = () => {
        form5.handleSubmit(async (step5) => {
            startTransition(async () => {
                await runActionWithToast(completeGenesis(step1Data, step2Data, step3Data, step4Data, step5), {
                    successMessage: 'สร้างร้านค้าสำเร็จ! เตรียมพบกับประสบการณ์ใหม่ของคุณ...',
                    onSuccess: async () => {
                        await update(); // Refresh JWT token
                        // Give 2 seconds for user to see the success message
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 2000);
                    },
                    onError: (error) => {
                        // We could map errors here if step5 has validation issues from server
                    }
                });
            });
        })();
    };

    const isLastStep = currentStep === 5;
    const isFirstStep = currentStep === 1;

    return (
        <div className="w-full">
            {/* ── Stepper ─────────────────────────────────────────────────────── */}
            <div className="flex items-center mb-8 select-none">
                {STEPS.map((step, idx) => {
                    const isDone = step.id < currentStep;
                    const isActive = step.id === currentStep;
                    const isUpcoming = step.id > currentStep;

                    return (
                        <div key={step.id} className="flex items-center flex-1 last:flex-none">
                            {/* Circle */}
                            <div className="flex flex-col items-center gap-1">
                                <div className={cn(
                                    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                                    isDone && 'bg-primary text-primary-foreground',
                                    isActive && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                                    isUpcoming && 'bg-muted text-muted-foreground',
                                )}>
                                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.id}
                                </div>
                                <span className={cn(
                                    'text-[10px] font-medium hidden sm:block',
                                    isActive ? 'text-foreground' : 'text-muted-foreground',
                                )}>
                                    {step.short}
                                </span>
                            </div>

                            {/* Connector */}
                            {idx < STEPS.length - 1 && (
                                <div className={cn(
                                    'flex-1 h-[2px] mx-2 rounded transition-all duration-500',
                                    step.id < currentStep ? 'bg-primary' : 'bg-border',
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Step Content ─────────────────────────────────────────────────── */}
            <div className="min-h-[340px]">
                {currentStep === 1 && (
                    <FormProvider {...form1}>
                        <WizardStep1Identity />
                    </FormProvider>
                )}
                {currentStep === 2 && (
                    <FormProvider {...form2}>
                        <WizardStep2Legal />
                    </FormProvider>
                )}
                {currentStep === 3 && (
                    <FormProvider {...form3}>
                        <WizardStep3Financial />
                    </FormProvider>
                )}
                {currentStep === 4 && (
                    <FormProvider {...form4}>
                        <WizardStep4Team />
                    </FormProvider>
                )}
                {currentStep === 5 && (
                    <FormProvider {...form5}>
                        <WizardStep5Data />
                    </FormProvider>
                )}
            </div>

            {/* ── Navigation Buttons ───────────────────────────────────────────── */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={isFirstStep || isPending}
                    className="gap-2"
                >
                    <ChevronLeft className="h-4 w-4" />
                    ย้อนกลับ
                </Button>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        ขั้นตอนที่ {currentStep} / {STEPS.length}
                    </span>
                    {isLastStep ? (
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="gap-2 min-w-[140px]"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    กำลังสร้าง...
                                </>
                            ) : (
                                <>
                                    เริ่มใช้งาน
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={isPending}
                            className="gap-2 min-w-[100px]"
                        >
                            ถัดไป
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
