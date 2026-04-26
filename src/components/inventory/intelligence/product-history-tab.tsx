'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { ProductIntelligenceSummary, StockMovementDTO, PaginatedIntelligence, SupplierIntelligenceDTO } from '@/types/intelligence';
import { getProductIntelligenceSummary, getProductMovementHistory, getProductSupplierIntelligence } from '@/actions/inventory/intelligence.actions';
import { IntelligenceSummaryCards } from '@/components/core/ai/intelligence-summary-cards';
import { IntelligenceFilterBar } from '@/components/core/ai/intelligence-filter-bar';
import { StockMovementTable } from './stock-movement-table';
import { VendorIntelligencePanel } from '@/components/purchases/intelligence/vendor-intelligence-panel';
import { LocalPagination } from '@/components/ui/local-pagination';
import { StockMovementType } from '@prisma/client';
import { runActionWithToast } from '@/lib/mutation-utils';

interface ProductHistoryTabProps {
    productId: string;
}

export function ProductHistoryTab({ productId }: ProductHistoryTabProps) {
    const [isPending, startTransition] = useTransition();
    const [summary, setSummary] = useState<ProductIntelligenceSummary | undefined>();
    const [history, setHistory] = useState<PaginatedIntelligence<StockMovementDTO> | undefined>();
    const [vendors, setVendors] = useState<SupplierIntelligenceDTO[]>([]);
    const [isVendorsLoading, setIsVendorsLoading] = useState(true);

    // Filters
    const [page, setPage] = useState(1);
    const [type, setType] = useState<string>('ALL');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const fetchSummary = useCallback(() => {
        runActionWithToast(getProductIntelligenceSummary(productId), {
            successMessage: '',
            onSuccess: (data) => setSummary(data)
        });
    }, [productId]);

    const fetchHistory = useCallback(() => {
        startTransition(async () => {
            const params: any = { page, limit: 20 };
            if (type !== 'ALL') params.type = type as StockMovementType;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            await runActionWithToast(getProductMovementHistory(productId, params), {
                successMessage: '',
                onSuccess: (data) => setHistory(data)
            });
        });
    }, [productId, page, type, startDate, endDate]);

    const fetchVendors = useCallback(() => {
        setIsVendorsLoading(true);
        runActionWithToast(getProductSupplierIntelligence(productId), {
            successMessage: '',
            onSuccess: (data) => setVendors(data || []),
            onFinally: () => setIsVendorsLoading(false)
        });
    }, [productId]);

    useEffect(() => {
        fetchSummary();
        fetchVendors();
    }, [fetchSummary, fetchVendors]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    return (
        <div className="space-y-8 pb-10">
            {/* 1. Summary Cards (Rule 5) */}
            <IntelligenceSummaryCards summary={summary} isLoading={!summary} />

            {/* 2. Vendor Context (Rule 2) */}
            <VendorIntelligencePanel vendors={vendors} isLoading={isVendorsLoading} />

            {/* 3. Filter Bar (Rule 6) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                        Movement History
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-medium">
                        Showing {history?.data.length || 0} of {history?.pagination.total || 0} movements
                    </p>
                </div>

                <IntelligenceFilterBar
                    type={type}
                    onTypeChange={(val) => { setType(val); setPage(1); }}
                    startDate={startDate}
                    onStartDateChange={(val) => { setStartDate(val); setPage(1); }}
                    endDate={endDate}
                    onEndDateChange={(val) => { setEndDate(val); setPage(1); }}
                />
            </div>

            {/* 4. Movement Table (Rule 1 & 4) */}
            <StockMovementTable
                logs={history?.data || []}
                isLoading={isPending && !history}
            />

            {/* 5. Pagination */}
            {history && history.pagination.totalPages > 1 && (
                <div className="flex justify-center pt-2">
                    <LocalPagination
                        currentPage={page}
                        totalPages={history.pagination.totalPages}
                        onPageChange={setPage}
                    />
                </div>
            )}
        </div>
    );
}
