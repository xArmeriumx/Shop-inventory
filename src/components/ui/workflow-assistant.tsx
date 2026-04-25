'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    ArrowRight,
    CheckCircle2,
    HelpCircle,
    Info,
    ChevronRight,
    BookOpen
} from 'lucide-react';

export interface WorkflowStep {
    label: string;
    action: string;
    onClick?: () => void;
    href?: string;
    description: string;
    isPrimary?: boolean;
}

export interface WorkflowAssistantProps {
    type: 'sale' | 'invoice' | 'purchase';
    status: string;
    steps: WorkflowStep[];
    className?: string;
}

export function WorkflowAssistant({ type, status, steps, className }: WorkflowAssistantProps) {
    if (steps.length === 0) return null;

    return (
        <div className={cn(
            "glass p-4 sm:p-5 rounded-2xl mb-6 flex flex-col md:flex-row items-start md:items-center gap-4 border-l-4 border-l-emerald-500",
            className
        )}>
            <div className="bg-emerald-500/10 p-3 rounded-xl hidden sm:block">
                <BookOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        Next Action Guide
                    </span>
                    <span className="text-slate-400 text-xs">| {status}</span>
                </div>

                <h4 className="text-slate-900 dark:text-slate-100 font-semibold text-sm sm:text-base truncate">
                    {steps[0].label}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm line-clamp-2">
                    {steps[0].description}
                </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                {steps.map((step, idx) => {
                    const button = (
                        <Button
                            onClick={step.onClick}
                            variant={step.isPrimary ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "flex-1 md:flex-none rounded-xl gap-2",
                                step.isPrimary && "bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-500/20"
                            )}
                        >
                            {step.action}
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    );

                    if (step.href) {
                        return (
                            <Link key={idx} href={step.href} className="flex-1 md:flex-none">
                                {button}
                            </Link>
                        );
                    }

                    return <React.Fragment key={idx}>{button}</React.Fragment>;
                })}
            </div>
        </div>
    );
}
