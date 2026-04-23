import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BackPageHeaderProps {
    /** URL the back arrow navigates to */
    backHref: string;
    title: string;
    description?: string;
    /** Optional slot for action buttons on the right */
    action?: React.ReactNode;
    className?: string;
}

// ─── BackPageHeader ───────────────────────────────────────────────────────────

/**
 * Standardized header for sub-pages that need a back navigation arrow.
 * Use instead of the repeated [ArrowLeft Button → h1 → p] pattern in detail/edit pages.
 *
 * @example
 * <BackPageHeader
 *   backHref="/settings"
 *   title="จัดการทีม"
 *   description="เพิ่มและจัดการสมาชิกในร้านของคุณ"
 * />
 */
export function BackPageHeader({ backHref, title, description, action, className }: BackPageHeaderProps) {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${className ?? ''}`}>
            <div className="flex items-start gap-3 min-w-0">
                <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
                    <Link href={backHref}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">{title}</h1>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-none">{description}</p>
                    )}
                </div>
            </div>
            {action && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 px-1 sm:px-0 sm:justify-end">
                    {action}
                </div>
            )}
        </div>
    );
}
