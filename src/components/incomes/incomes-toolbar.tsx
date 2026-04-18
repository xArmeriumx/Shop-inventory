'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { INCOME_CATEGORIES } from '@/schemas/income';
import { Search, X, Calendar } from 'lucide-react';
import { useState, useTransition } from 'react';

interface IncomesToolbarProps {
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export function IncomesToolbar({
  search: initialSearch = '',
  category: initialCategory = '',
  startDate: initialStartDate = '',
  endDate: initialEndDate = '',
}: IncomesToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.delete('page'); // Reset to page 1 when filters change
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search });
  };

  const handleCategoryChange = (value: string) => {
    updateParams({ category: value });
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    updateParams({ [field]: value });
  };

  const clearFilters = () => {
    setSearch('');
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilters = initialSearch || initialCategory || initialStartDate || initialEndDate;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ค้นหารายละเอียด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </form>

        {/* Category filter */}
        <select
          value={initialCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          disabled={isPending}
        >
          <option value="">ทุกหมวดหมู่</option>
          {INCOME_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={initialStartDate}
          onChange={(e) => handleDateChange('startDate', e.target.value)}
          className="w-auto h-8 text-sm"
          disabled={isPending}
        />
        <span className="text-muted-foreground">-</span>
        <Input
          type="date"
          value={initialEndDate}
          onChange={(e) => handleDateChange('endDate', e.target.value)}
          className="w-auto h-8 text-sm"
          disabled={isPending}
        />
        
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isPending}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            ล้าง
          </Button>
        )}
      </div>
    </div>
  );
}
