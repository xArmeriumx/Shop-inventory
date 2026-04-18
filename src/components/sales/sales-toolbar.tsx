'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { PAYMENT_METHODS, SALES_CHANNELS, SALES_STATUSES } from '@/lib/constants';
import { Search, X, Calendar } from 'lucide-react';

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
  const { updateFilters, clearFilters, isPending } = useUrlFilters();
  const [searchValue, setSearchValue] = useState(search);

  const handleSearch = () => updateFilters({ search: searchValue });
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };
  const hasFilters = search || startDate || endDate || paymentMethod || channel || status;

  const SELECT_CLASS = 'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-full sm:w-auto';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ค้นหาเลขที่ใบเสร็จ, ลูกค้า..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={handleKeyDown} className="pl-9" />
          </div>
          <Button onClick={handleSearch} disabled={isPending}>ค้นหา</Button>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-2">
          <select value={channel} onChange={(e) => updateFilters({ channel: e.target.value })} className={SELECT_CLASS}>
            <option value="">ทุกช่องทาง</option>
            {SALES_CHANNELS.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
          </select>
          <select value={paymentMethod} onChange={(e) => updateFilters({ paymentMethod: e.target.value })} className={SELECT_CLASS}>
            <option value="">ทุกวิธีชำระ</option>
            {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={status} onChange={(e) => updateFilters({ status: e.target.value })} className={SELECT_CLASS}>
            <option value="">ทุกสถานะ</option>
            {SALES_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Date Range */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input type="date" value={startDate} onChange={(e) => updateFilters({ startDate: e.target.value })} className="flex-1 min-w-0" />
          <span className="text-sm text-muted-foreground shrink-0">ถึง</span>
          <Input type="date" value={endDate} onChange={(e) => updateFilters({ endDate: e.target.value })} className="flex-1 min-w-0" />
        </div>
      </div>
    </div>
  );
}
