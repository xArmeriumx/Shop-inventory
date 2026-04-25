'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

interface ReportToolbarProps {
  startDate?: string;
  endDate?: string;
}

/**
 * ReportToolbar — Clean, minimalist diagnostic filter.
 * Simplified UI as per user request, maintaining SSOT logic.
 */
export function ReportToolbar({ startDate, endDate }: ReportToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const [dateRange, setDateRange] = useState({ 
    start: startDate || new Date().toISOString().split('T')[0].substring(0, 8) + '01', 
    end: endDate || new Date().toISOString().split('T')[0]
  });

  const handleFilter = () => {
    const params = new URLSearchParams(searchParams);
    if (dateRange.start) params.set('startDate', dateRange.start);
    if (dateRange.end) params.set('endDate', dateRange.end);
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const setPreset = (type: 'today' | 'thisMonth' | 'lastMonth' | 'last7days') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'today') {
      // today
    } else if (type === 'last7days') {
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
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
    
    const params = new URLSearchParams(searchParams);
    params.set('startDate', startStr);
    params.set('endDate', endStr);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="bg-card border rounded-lg p-4 print:hidden flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 px-3 border-r pr-4">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">ตัวกรอง</span>
            </div>

            <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground uppercase">ตั้งแต่วันที่</label>
                <Input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-[140px] h-9"
                />
            </div>

            <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground uppercase">ถึงวันที่</label>
                <Input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-[140px] h-9"
                />
            </div>

            <Button 
                onClick={handleFilter} 
                disabled={isPending}
                size="sm"
                className="gap-2"
            >
                {isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'อัปเดตรายงาน'}
            </Button>
        </div>

        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
            {[
                { id: 'today', label: 'วันนี้' },
                { id: 'last7days', label: '7 วันล่าสุด' },
                { id: 'thisMonth', label: 'เดือนนี้' },
                { id: 'lastMonth', label: 'เดือนที่แล้ว' }
            ].map((preset) => (
                <Button 
                    key={preset.id}
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[11px] font-medium px-3"
                    onClick={() => setPreset(preset.id as any)}
                >
                    {preset.label}
                </Button>
            ))}
        </div>
    </div>
  );
}
