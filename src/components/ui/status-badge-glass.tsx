import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusBadgeGlassProps {
    status: string;
    className?: string;
    variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
}

const colorMap = {
    default: 'bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500/30',
    success: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
    destructive: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30',
};

export function StatusBadgeGlass({ status, className, variant = 'default' }: StatusBadgeGlassProps) {
    return (
        <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border transition-all duration-300",
            colorMap[variant],
            className
        )}>
            <span className={cn("w-1.5 h-1.5 rounded-full mr-2 animate-pulse",
                variant === 'success' ? 'bg-emerald-500' :
                    variant === 'warning' ? 'bg-amber-500' :
                        variant === 'destructive' ? 'bg-rose-500' :
                            variant === 'info' ? 'bg-sky-500' : 'bg-slate-500'
            )} />
            {status}
        </span>
    );
}
