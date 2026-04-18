import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface TablePaginationProps {
    pagination: PaginationInfo;
    onPageChange: (page: number) => void;
    isPending?: boolean;
}

// ─── TablePagination ─────────────────────────────────────────────────────────

/**
 * Reusable pagination row for data tables.
 * Replaces the duplicated "แสดง X-Y จาก Z รายการ" + prev/next pattern.
 *
 * @example
 * <TablePagination pagination={pagination} onPageChange={goToPage} />
 */
export function TablePagination({ pagination, onPageChange, isPending }: TablePaginationProps) {
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
                แสดง {from}–{to} จาก {pagination.total} รายการ
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage || isPending}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums">
                    หน้า {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage || isPending}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
