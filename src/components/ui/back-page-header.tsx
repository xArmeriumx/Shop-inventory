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
        <div className={`flex items-start justify-between gap-4 ${className ?? ''}`}>
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                    <Link href={backHref}>
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                    {description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                    )}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
