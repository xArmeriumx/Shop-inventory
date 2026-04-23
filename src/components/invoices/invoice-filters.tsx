'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Filter } from 'lucide-react';
import { useUrlFilters } from '@/hooks/use-url-filters';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface InvoiceFiltersProps {
    search?: string;
    status?: string;
}

const INVOICE_STATUS_OPTIONS = [
    { label: 'ทั้งหมด', value: '' },
    { label: 'ฉบับร่าง (Draft)', value: 'DRAFT' },
    { label: 'บันทึกแล้ว (Posted)', value: 'POSTED' },
    { label: 'ชำระแล้ว (Paid)', value: 'PAID' },
    { label: 'ยกเลิก (Cancelled)', value: 'CANCELLED' },
];

export function InvoiceFilters({ search = '', status = '' }: InvoiceFiltersProps) {
    const { updateFilters, clearFilters, isPending } = useUrlFilters();
    const [searchValue, setSearchValue] = useState(search);

    const handleSearch = () => {
        updateFilters({ search: searchValue, status });
    };

    const handleStatusChange = (newStatus: string) => {
        updateFilters({ search: searchValue, status: newStatus });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleClear = () => {
        setSearchValue('');
        clearFilters();
    };

    const hasFilters = search || status;

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
            <div className="flex flex-1 flex-wrap gap-3 items-center">
                <div className="relative flex-1 max-w-sm min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาเลขที่ใบแจ้งหนี้ หรือชื่อลูกค้า..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-9"
                    />
                </div>

                <div className="w-[180px]">
                    <Select value={status || ''} onValueChange={handleStatusChange}>
                        <SelectTrigger>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <SelectValue placeholder="สถานะทั้งหมด" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {INVOICE_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value || 'all'} value={opt.value || 'all'}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button onClick={handleSearch} disabled={isPending} variant="default">
                    ค้นหา
                </Button>

                {hasFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground">
                        <X className="mr-1 h-4 w-4" /> ล้างตัวกรอง
                    </Button>
                )}
            </div>
        </div>
    );
}
