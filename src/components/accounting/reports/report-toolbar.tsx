'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Filter, RefreshCw, Zap, Clock, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';

interface ReportToolbarProps {
  startDate?: string;
  endDate?: string;
}

/**
 * ReportToolbar — Unified diagnostic filter for the Analytics Hub (Phase 3).
 * Provides intuitive date-range selections with executive-level aesthetics.
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
      // Current day
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
    <div className="bg-muted/30 backdrop-blur-md rounded-[2.5rem] border-2 p-6 print:hidden shadow-xl shadow-black/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Filter className="h-20 w-20" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-8">
            {/* 1. Diagnostic Title */}
            <div className="flex items-center gap-4 shrink-0">
                <div className="h-12 w-12 rounded-2xl bg-foreground text-background flex items-center justify-center shadow-lg">
                    <Clock className="h-6 w-6" />
                </div>
                <div>
                    <h4 className="text-lg font-black tracking-tighter">Time Horizon</h4>
                    <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Range Diagnostic</p>
                </div>
            </div>

            {/* 2. Range Controls */}
            <div className="flex flex-wrap items-center justify-center gap-4 bg-background/50 p-2 rounded-[2rem] border-2 shadow-inner">
                <div className="flex items-center px-4 gap-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">From</span>
                    <Input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="w-[140px] border-none bg-transparent font-black text-sm p-0 h-auto focus-visible:ring-0"
                    />
                </div>
                
                <div className="h-8 w-px bg-border hidden sm:block" />
                
                <div className="flex items-center px-4 gap-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">To</span>
                    <Input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="w-[140px] border-none bg-transparent font-black text-sm p-0 h-auto focus-visible:ring-0"
                    />
                </div>

                <Button 
                    onClick={handleFilter} 
                    disabled={isPending}
                    className="rounded-full bg-foreground text-background font-black px-6 h-10 hover:bg-foreground/90 transition-transform active:scale-95 shadow-lg"
                >
                    {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Apply Filter'}
                </Button>
            </div>

            {/* 3. Executive Presets */}
            <div className="flex items-center gap-2 bg-muted h-12 p-1 rounded-2xl border shadow-inner">
                {[
                    { id: 'today', label: 'Today', icon: Zap },
                    { id: 'last7days', label: '7D', icon: CalendarDays },
                    { id: 'thisMonth', label: 'M-1', icon: CalendarIcon },
                    { id: 'lastMonth', label: 'M-2', icon: Clock }
                ].map((preset) => (
                    <Button 
                        key={preset.id}
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl h-full px-4 text-[10px] font-black uppercase tracking-wider hover:bg-background hover:shadow-sm"
                        onClick={() => setPreset(preset.id as any)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
        </div>
    </div>
  );
}
