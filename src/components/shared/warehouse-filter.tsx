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
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select
                value={activeWarehouseId || 'ALL'}
                onValueChange={handleValueChange}
                disabled={isPending}
            >
                <SelectTrigger className="w-[180px] bg-background h-9">
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">คลังสินค้าทั้งหมด</SelectItem>
                    {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                            {w.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
