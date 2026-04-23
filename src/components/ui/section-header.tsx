import * as React from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SectionHeaderProps {
    title: string;
    description?: string;
    /** Optional slot for action button(s) on the right */
    action?: React.ReactNode;
    className?: string;
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

/**
 * Generic page/section title block.
 * Use at the top of a page or a major card section.
 *
 * @example
 * <SectionHeader
 *   title="รายการสินค้า"
 *   description="จัดการสินค้าทั้งหมดในระบบ"
 *   action={<Button asChild><Link href="/products/new">เพิ่มสินค้า</Link></Button>}
 * />
 */
export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
    return (
        <div className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${className ?? ''}`}>
            <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{title}</h1>
                {description && (
                    <p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">{description}</p>
                )}
            </div>
            {action && (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 sm:justify-end">
                    {action}
                </div>
            )}
        </div>
    );
}
