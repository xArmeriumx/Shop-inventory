'use client';

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ============================================================================
// FormField — Single Source of Truth for field rendering
// 
// Provides consistent: label, error display, hint text, required marker.
// Works with react-hook-form's FormProvider (useFormContext).
// ============================================================================

interface FormFieldProps {
    name: string;
    label: string;
    required?: boolean;
    hint?: string;
    className?: string;
    children: React.ReactNode;
}

/**
 * Wraps any input element with consistent label + error + hint layout.
 * Reads validation errors from react-hook-form context automatically.
 */
export function FormField({ name, label, required, hint, className, children }: FormFieldProps) {
    const { formState: { errors } } = useFormContext();

    // Support nested field names like "metadata.weight"
    const error = name.split('.').reduce<any>((acc, key) => acc?.[key], errors);
    const errorMessage = error?.message as string | undefined;

    return (
        <div className={cn('space-y-1.5', className)}>
            <Label htmlFor={name} className="text-sm font-medium">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {children}
            {hint && !errorMessage && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            {errorMessage && (
                <p className="text-xs text-destructive">{errorMessage}</p>
            )}
        </div>
    );
}
