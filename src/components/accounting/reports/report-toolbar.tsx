'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';

interface ReportToolbarProps {
  startDate?: string;
  endDate?: string;
}

export function ReportToolbar({ startDate, endDate }: ReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const [dateRange, setDateRange] = useState({ 
    start: startDate || new Date().toISOString().split('T')[0].substring(0, 8) + '01', // First day of current month
    end: endDate || new Date().toISOString().split('T')[0]
  });

  const handleFilter = () => {
    const params = new URLSearchParams(searchParams);
    if (dateRange.start) params.set('startDate', dateRange.start);
    if (dateRange.end) params.set('endDate', dateRange.end);
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const setPreset = (type: 'today' | 'thisMonth' | 'lastMonth') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'today') {
      // already set
    } else if (type === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (type === 'lastMonth') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    setDateRange({ start: startStr, end: endStr });
    
    // Auto submit for presets
    const params = new URLSearchParams(searchParams);
    params.set('startDate', startStr);
    params.set('endDate', endStr);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="bg-card border rounded-lg p-4 mb-6 print:hidden">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">ตั้งแต่วันที่</label>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-auto"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">ถึงวันที่</label>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-auto"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleFilter} disabled={isPending}>
            ดูรายงาน
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreset('today')}>วันนี้</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset('thisMonth')}>เดือนนี้</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset('lastMonth')}>เดือนที่แล้ว</Button>
        </div>
      </div>
    </div>
  );
}
