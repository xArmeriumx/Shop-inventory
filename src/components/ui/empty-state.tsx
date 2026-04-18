import * as React from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
    /** Optional icon to display above the title */
    icon?: React.ReactNode;
    title: string;
    description?: string;
    /** Optional CTA button / link */
    action?: React.ReactNode;
    className?: string;
}

// ─── EmptyState ──────────────────────────────────────────────────────────────

/**
 * Generic "no data" state component.
 * Use in table bodies, lists, or any empty section.
 *
 * @example
 * <EmptyState
 *   icon={<Package className="h-8 w-8" />}
 *   title="ยังไม่มีสินค้า"
 *   description="เริ่มต้นด้วยการเพิ่มสินค้าแรก"
 *   action={<Button asChild><Link href="/products/new">เพิ่มสินค้า</Link></Button>}
 * />
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 text-center gap-3 ${className ?? ''}`}>
            {icon && (
                <div className="text-muted-foreground opacity-40">
                    {icon}
                </div>
            )}
            <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            {action && <div className="pt-2">{action}</div>}
        </div>
    );
}
