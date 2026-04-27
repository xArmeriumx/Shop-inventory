'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { Search, X } from 'lucide-react';

import { WarehouseFilter } from '@/components/shared/warehouse-filter';

interface ProductsToolbarProps {
  search: string;
  category: string;
  warehouseId?: string;
  warehouses: any[];
}

export function ProductsToolbar({ search, category, warehouseId, warehouses }: ProductsToolbarProps) {
  const { updateFilters, clearFilters, isPending } = useUrlFilters();
  const [searchValue, setSearchValue] = useState(search);

  const handleSearch = () => updateFilters({ search: searchValue });
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };
  const hasFilters = search || category;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหาสินค้า..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={isPending}>ค้นหา</Button>
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => updateFilters({ category: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          disabled={isPending}
        >
          <option value="">ทุกหมวดหมู่</option>
          {PRODUCT_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>

        <WarehouseFilter
          warehouses={warehouses}
          activeWarehouseId={warehouseId}
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  );
}
