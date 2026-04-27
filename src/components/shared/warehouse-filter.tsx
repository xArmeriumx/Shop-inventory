'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { useUrlFilters } from '@/hooks/use-url-filters';

interface Warehouse {
    id: string;
    name: string;
}

interface WarehouseFilterProps {
    warehouses: Warehouse[];
    activeWarehouseId?: string;
    placeholder?: string;
    className?: string;
}

/**
 * Reusable Warehouse Filter component that syncs with URL params.
 * Uses useUrlFilters hook to ensure standard behavior across all pages.
 */
export function WarehouseFilter({
    warehouses,
    activeWarehouseId,
    placeholder = "เลือกคลังสินค้า",
    className
}: WarehouseFilterProps) {
    const { updateFilters, isPending } = useUrlFilters();

    const handleValueChange = (value: string) => {
        updateFilters({ warehouseId: value === 'ALL' ? '' : value });
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <Building2 className={`h-4 w-4 ${activeWarehouseId ? 'text-indigo-600' : 'text-muted-foreground'}`} />
            <Select
                value={activeWarehouseId || 'ALL'}
                onValueChange={handleValueChange}
                disabled={isPending}
            >
                <SelectTrigger className={`w-[200px] h-9 transition-all duration-200 ${activeWarehouseId
                        ? 'bg-indigo-50/50 border-indigo-200 ring-indigo-200 text-indigo-900 font-medium'
                        : 'bg-background'
                    }`}>
                    <div className="flex items-center gap-2 truncate">
                        {activeWarehouseId && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                        <SelectValue placeholder={placeholder} />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL" className="font-medium">คลังสินค้าทั้งหมด</SelectItem>
                    <div className="h-px bg-muted my-1" />
                    {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                            <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                {w.name}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
