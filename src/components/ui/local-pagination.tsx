'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocalPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function LocalPagination({ currentPage, totalPages, onPageChange }: LocalPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center px-4">
                <span className="text-xs font-bold">
                    Page {currentPage} of {totalPages}
                </span>
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    );
}
