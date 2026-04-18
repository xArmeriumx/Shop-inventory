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
        <div className={`flex items-start justify-between gap-4 ${className ?? ''}`}>
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
                {description && (
                    <p className="text-sm sm:text-base text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
