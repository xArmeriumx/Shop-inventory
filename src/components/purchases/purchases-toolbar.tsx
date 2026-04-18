'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Search, X, Calendar } from 'lucide-react';

interface PurchasesToolbarProps {
  search?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}

export function PurchasesToolbar({
  search = '',
  startDate = '',
  endDate = '',
  paymentMethod = '',
}: PurchasesToolbarProps) {
  const { updateFilters, clearFilters, isPending } = useUrlFilters();
  const [searchValue, setSearchValue] = useState(search);

  const handleSearch = () => updateFilters({ search: searchValue });
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };
  const hasFilters = search || startDate || endDate || paymentMethod;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ค้นหาเลขที่ใบสั่งซื้อ..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={handleKeyDown} className="pl-9" />
          </div>
          <Button onClick={handleSearch} disabled={isPending}>ค้นหา</Button>
        </div>

        {/* Payment Method */}
        <select value={paymentMethod} onChange={(e) => updateFilters({ paymentMethod: e.target.value })} className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm">
          <option value="">ทุกวิธีชำระ</option>
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input type="date" value={startDate} onChange={(e) => updateFilters({ startDate: e.target.value })} className="w-auto" />
        <span className="text-sm text-muted-foreground">ถึง</span>
        <Input type="date" value={endDate} onChange={(e) => updateFilters({ endDate: e.target.value })} className="w-auto" />
      </div>
    </div>
  );
}
