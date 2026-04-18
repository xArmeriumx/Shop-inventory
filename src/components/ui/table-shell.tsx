import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TableShellProps {
    /** Optional top toolbar area (filters, search, action buttons) */
    toolbar?: React.ReactNode;
    /** The actual <Table> element */
    children: React.ReactNode;
    /** Optional bottom pagination row */
    pagination?: React.ReactNode;
    className?: string;
}

// ─── TableShell ──────────────────────────────────────────────────────────────

/**
 * Generic layout wrapper for data tables.
 * Provides consistent spacing for toolbar → table → pagination.
 *
 * @example
 * <TableShell
 *   toolbar={<ProductsToolbar />}
 *   pagination={<Pagination total={total} />}
 * >
 *   <ProductsTable products={products} />
 * </TableShell>
 */
export function TableShell({ toolbar, children, pagination, className }: TableShellProps) {
    return (
        <Card className={className}>
            {toolbar && (
                <div className="border-b px-4 py-3 sm:px-6">
                    {toolbar}
                </div>
            )}
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    {children}
                </div>
            </CardContent>
            {pagination && (
                <div className="border-t px-4 py-3 sm:px-6">
                    {pagination}
                </div>
            )}
        </Card>
    );
}
