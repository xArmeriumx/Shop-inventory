'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================================================
// FormField — Single Source of Truth for field rendering (Enhanced Phase 3)
// 
// Provides consistent: label, error display with animation, icon support,
// hint text, and required marker. Works with react-hook-form context.
// ============================================================================

interface FormFieldProps {
    name: string;
    label: string;
    required?: boolean;
    hint?: string;
    className?: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
}

/**
 * Wraps any input element with consistent label + error + hint layout.
 * Reads validation errors from react-hook-form context automatically.
 */
export function FormField({ name, label, required, hint, className, children, icon }: FormFieldProps) {
    const { formState: { errors } } = useFormContext();

    // Support nested field names like "metadata.weight"
    const error = name.split('.').reduce<any>((acc, key) => acc?.[key], errors);
    const errorMessage = error?.message as string | undefined;

    return (
        <div className={cn('space-y-1.5 md:space-y-2 w-full', className)}>
            <Label 
                htmlFor={name} 
                className={cn(
                    "text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors",
                    errorMessage ? "text-destructive" : "text-muted-foreground"
                )}
            >
                {icon && <span className="opacity-70">{icon}</span>}
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            
            <div className="relative">
                {children}
                
                {errorMessage && (
                    <div className="mt-1.5 animate-in slide-in-from-top-1 duration-200">
                        <p className="text-[10px] font-bold text-destructive flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-destructive" />
                            {errorMessage}
                        </p>
                    </div>
                )}

                {hint && !errorMessage && (
                    <p className="mt-1 text-[10px] text-muted-foreground opacity-70 leading-relaxed italic">
                        {hint}
                    </p>
                )}
            </div>
        </div>
    );
}
