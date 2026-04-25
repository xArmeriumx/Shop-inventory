'use client';

import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
  icon?: ReactNode;
  description?: string;
}

/**
 * FormField — มาตรฐานกลางสำหรับการจัดวาง Input, Label และ Error
 * เป็นส่วนประกอบสำคัญของ Clean Code & Standard UI
 */
export function FormField({
  label,
  error,
  children,
  className,
  required,
  icon,
  description
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2 w-full", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className={cn(
            "text-xs font-bold uppercase tracking-wider flex items-center gap-2",
            error ? "text-destructive" : "text-muted-foreground"
          )}>
            {icon && <span className="opacity-70">{icon}</span>}
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </Label>
        </div>
      )}
      
      <div className="relative group">
        {children}
        {error && (
          <div className="mt-1.5 animate-in slide-in-from-top-1 duration-200">
             <p className="text-[10px] font-bold text-destructive flex items-center gap-1.5">
               <span className="h-1 w-1 rounded-full bg-destructive" />
               {error}
             </p>
          </div>
        )}
      </div>

      {description && !error && (
        <p className="text-[10px] text-muted-foreground opacity-70 leading-relaxed italic">
          {description}
        </p>
      )}
    </div>
  );
}
