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
                    successMessage: 'สร้างร้านค้าสำเร็จ! กำลังปรับแต่งระบบให้พร้อมใช้งาน...',
                    onSuccess: async () => {
                        await update(); // Refresh JWT token
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 2000);
                    },
                });
            });
        })();
    };

    const isLastStep = currentStep === 5;
    const isFirstStep = currentStep === 1;

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* ── Stepper: Modern & Fluid ────────────────────────────────────────── */}
            <div className="relative mb-12 select-none">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, idx) => {
                        const isDone = step.id < currentStep;
                        const isActive = step.id === currentStep;
                        const isUpcoming = step.id > currentStep;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center group">
                                <div className={cn(
                                    'h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 shadow-sm border-2',
                                    isDone && 'bg-primary border-primary text-primary-foreground transform scale-90 opacity-40',
                                    isActive && 'bg-background border-primary text-primary ring-8 ring-primary/10 shadow-xl scale-110',
                                    isUpcoming && 'bg-background border-border text-muted-foreground',
                                )}>
                                    {isDone ? <CheckCircle2 className="h-6 w-6" /> : step.id}
                                </div>
                                <div className="absolute -bottom-8 w-max">
                                    <span className={cn(
                                        'text-[11px] font-bold uppercase tracking-wider transition-colors duration-300',
                                        isActive ? 'text-primary' : (isDone ? 'text-primary/60' : 'text-muted-foreground/50'),
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Connector Line behind steps */}
                <div className="absolute top-6 left-0 w-full h-[2px] bg-border -z-0">
                    <div 
                        className="h-full bg-primary transition-all duration-700 ease-in-out" 
                        style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                    />
                </div>
            </div>

            {/* ── Step Content: Rich & Focused ────────────────────────────────────── */}
            <div className="bg-card/50 backdrop-blur-sm border rounded-3xl p-8 shadow-2xl shadow-primary/5 min-h-[450px] transition-all duration-500">
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

            {/* ── Navigation Buttons: Elegant Control ────────────────────────────── */}
            <div className="flex items-center justify-between mt-10">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isFirstStep || isPending}
                    className="h-12 px-8 rounded-2xl border-2 hover:bg-muted font-bold transition-all"
                >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    ย้อนกลับ
                </Button>

                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest leading-none">Progress</span>
                        <span className="text-xl font-black text-primary leading-tight">
                            {Math.round(((currentStep) / STEPS.length) * 100)}%
                        </span>
                    </div>

                    {isLastStep ? (
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    กำลังเริ่มระบบ...
                                </>
                            ) : (
                                <>
                                    ยันยันและเริ่มใช้งาน
                                    <Rocket className="ml-3 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={handleNext}
                            disabled={isPending}
                            className="h-14 px-12 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black text-lg shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            ดำเนินการต่อ
                            <ChevronRight className="ml-2 h-6 w-6" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Re-importing missing icons
import { Rocket } from 'lucide-react';
