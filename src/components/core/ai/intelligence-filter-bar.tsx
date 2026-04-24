'use client';

import { StockMovementType } from '@prisma/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

interface IntelligenceFilterBarProps {
    type?: string;
    onTypeChange: (value: string) => void;
    startDate?: string;
    onStartDateChange: (value: string) => void;
    endDate?: string;
    onEndDateChange: (value: string) => void;
}

const TYPE_OPTIONS = [
    { value: 'ALL', label: 'All Movements' },
    { value: 'SALE', label: 'Sale Outputs' },
    { value: 'PURCHASE', label: 'Purchase Inputs' },
    { value: 'RETURN', label: 'Returns' },
    { value: 'ADJUST', label: 'Adjustments' },
    { value: 'STOCK_TAKE_RECONCILIATION', label: 'Stock Take' },
];

export function IntelligenceFilterBar({
    type,
    onTypeChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange
}: IntelligenceFilterBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border">
            <div className="w-[180px]">
                <Select value={type || 'ALL'} onValueChange={onTypeChange}>
                    <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        {TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="date"
                        value={startDate || ''}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>
                <span className="text-muted-foreground text-xs font-medium">to</span>
                <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="date"
                        value={endDate || ''}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        className="pl-9 bg-white"
                    />
                </div>
            </div>
        </div>
    );
}
