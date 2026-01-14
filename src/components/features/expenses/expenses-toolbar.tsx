'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Calendar } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/schemas/expense';
import { useCallback, useState, useTransition } from 'react';

interface ExpensesToolbarProps {
  search?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export function ExpensesToolbar({
  search = '',
  category = '',
  startDate = '',
  endDate = '',
}: ExpensesToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search);
  const [dateRange, setDateRange] = useState({ start: startDate, end: endDate });

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      params.set('page', '1');

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const handleSearch = useCallback(() => {
    updateParams({ search: searchValue });
  }, [searchValue, updateParams]);

  const handleDateFilter = () => {
    updateParams({
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearchValue('');
    setDateRange({ start: '', end: '' });
    router.push(pathname);
  };

  const hasFilters = search || category || startDate || endDate;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหารายละเอียด..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isPending}>
            ค้นหา
          </Button>
        </div>

        <select
          value={category}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="">ทุกหมวดหมู่</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input
          type="date"
          value={dateRange.start}
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          className="w-auto"
        />
        <span className="text-sm text-muted-foreground">ถึง</span>
        <Input
          type="date"
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          className="w-auto"
        />
        <Button
          onClick={handleDateFilter}
          variant="outline"
          size="sm"
          disabled={isPending}
        >
          กรอง
        </Button>
      </div>
    </div>
  );
}
