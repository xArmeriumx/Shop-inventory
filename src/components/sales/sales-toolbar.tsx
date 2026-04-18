'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Calendar } from 'lucide-react';
import { PAYMENT_METHODS, SALES_CHANNELS, SALES_STATUSES } from '@/lib/constants';
import { useCallback, useState, useTransition } from 'react';

interface SalesToolbarProps {
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  channel?: string;
  status?: string;
}

export function SalesToolbar({
  search = '',
  startDate = '',
  endDate = '',
  paymentMethod = '',
  channel = '',
  status = '',
}: SalesToolbarProps) {
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

  const hasFilters = search || startDate || endDate || paymentMethod || channel || status;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ค้นหาเลขที่ใบเสร็จ, ลูกค้า..."
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

        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
          <select
            value={channel}
            onChange={(e) => updateParams({ channel: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full sm:w-auto"
          >
            <option value="">ทุกช่องทาง</option>
            {SALES_CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>
                {ch.label}
              </option>
            ))}
          </select>

          <select
            value={paymentMethod}
            onChange={(e) => updateParams({ paymentMethod: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full sm:w-auto"
          >
            <option value="">ทุกวิธีชำระ</option>
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full sm:w-auto"
          >
            <option value="">ทุกสถานะ</option>
            {SALES_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="flex-1 min-w-0"
          />
          <span className="text-sm text-muted-foreground flex-shrink-0">ถึง</span>
          <Input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="flex-1 min-w-0"
          />
        </div>
        <Button
          onClick={handleDateFilter}
          variant="outline"
          size="sm"
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          กรอง
        </Button>
      </div>
    </div>
  );
}

