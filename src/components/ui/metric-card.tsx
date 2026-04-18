import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MetricCardProps {
    /** Label shown above the value */
    label: string;
    /** Primary display value (already formatted) */
    value: string;
    /** Small hint text below the value */
    hint?: string;
    /** Icon element (e.g. a Lucide icon) */
    icon?: React.ReactNode;
    /** Optional: wraps the card in a Next.js Link */
    href?: string;
    /** CSS class for the icon */
    iconClassName?: string;
}

// ─── MetricCard ─────────────────────────────────────────────────────────────

export function MetricCard({ label, value, hint, icon, href, iconClassName }: MetricCardProps) {
    const content = (
        <Card className={href ? 'hover:bg-muted/50 transition-colors cursor-pointer' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {label}
                </CardTitle>
                {icon && (
                    <span className={iconClassName ?? 'text-muted-foreground'}>
                        {icon}
                    </span>
                )}
            </CardHeader>
            <CardContent className="pt-0">
                <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
                {hint && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{hint}</p>}
            </CardContent>
        </Card>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

// ─── MetricGrid ──────────────────────────────────────────────────────────────

export interface MetricGridProps {
    items: MetricCardProps[];
    /** Number of columns on large screens (default: 4) */
    columns?: 2 | 3 | 4 | 6;
}

const colClass: Record<number, string> = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 md:grid-cols-3',
    4: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    6: 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
};

export function MetricGrid({ items, columns = 4 }: MetricGridProps) {
    return (
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${colClass[columns]}`}>
            {items.map((item, index) => (
                <MetricCard key={index} {...item} />
            ))}
        </div>
    );
}
