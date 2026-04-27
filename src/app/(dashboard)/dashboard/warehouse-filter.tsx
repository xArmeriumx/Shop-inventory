'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface Warehouse {
    id: string;
    name: string;
}

export function WarehouseFilter({
    warehouses,
    activeWarehouseId
}: {
    warehouses: Warehouse[];
    activeWarehouseId?: string;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleValueChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === 'ALL') {
            params.delete('warehouseId');
        } else {
            params.set('warehouseId', value);
        }
        router.push(`/dashboard?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={activeWarehouseId || 'ALL'} onValueChange={handleValueChange}>
                <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="เลือกคลังสินค้า" />
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
