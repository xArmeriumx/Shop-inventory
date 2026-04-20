'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

interface PaginationProps {
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
    className?: string;
}

export function PaginationControl({ pagination, className = "" }: PaginationProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(newPage));
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    if (!pagination || pagination.totalPages <= 1) return null;

    const startItem = pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1;
    const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-6 border-t border-border/40 ${className}`}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground order-2 sm:order-1 font-medium">
                <span className="text-foreground">
                    แสดง {startItem} - {endItem}
                </span>
                <span>จาก</span>
                <span className="font-bold text-foreground">{pagination.total}</span>
                <span>รายการ</span>
            </div>

            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50 order-1 sm:order-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg hover:bg-background hover:shadow-sm transition-all"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage || isPending}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center px-4 min-w-[100px] justify-center">
                    <span className="text-sm font-bold">
                        หน้า {pagination.page}
                    </span>
                    <span className="text-xs text-muted-foreground mx-2">/</span>
                    <span className="text-sm text-muted-foreground">
                        {pagination.totalPages}
                    </span>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg hover:bg-background hover:shadow-sm transition-all"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage || isPending}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
