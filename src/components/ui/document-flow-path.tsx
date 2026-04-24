'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Dot } from 'lucide-react';

export interface FlowStep {
    id: string;
    label: string;
    status: 'completed' | 'current' | 'pending' | 'skipped';
    description?: string;
}

interface DocumentFlowPathProps {
    steps: FlowStep[];
    className?: string;
}

/**
 * A premium UI component to visualize the document lifecycle.
 * Used at the top of detail pages to show the "Journey" of the current document.
 */
export function DocumentFlowPath({ steps, className }: DocumentFlowPathProps) {
    return (
        <div className={cn("relative w-full py-4 overflow-x-auto scrollbar-hide", className)}>
            <div className="flex items-center min-w-[600px] px-4">
                {steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'current';

                    return (
                        <React.Fragment key={step.id}>
                            {/* Step Node */}
                            <div className="flex flex-col items-center group relative cursor-help">
                                <div
                                    className={cn(
                                        "z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                                        isCompleted
                                            ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20"
                                            : isCurrent
                                                ? "bg-background border-primary text-primary ring-4 ring-primary/10"
                                                : "bg-muted border-muted-foreground/20 text-muted-foreground/30"
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-4 w-4 stroke-[3]" />
                                    ) : (
                                        <span className="text-xs font-bold">{idx + 1}</span>
                                    )}
                                </div>
                                <div className="absolute top-10 flex flex-col items-center w-max">
                                    <span
                                        className={cn(
                                            "text-[10px] font-black uppercase tracking-wider transition-colors",
                                            isCurrent ? "text-primary" : "text-muted-foreground/60"
                                        )}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                            </div>

                            {/* Connecting Line */}
                            {!isLast && (
                                <div className="flex-1 px-2">
                                    <div
                                        className={cn(
                                            "h-0.5 w-full rounded-full transition-colors duration-500",
                                            isCompleted ? "bg-primary" : "bg-muted-foreground/10"
                                        )}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            {/* Spacer for label height */}
            <div className="h-8 mt-2" />
        </div>
    );
}
