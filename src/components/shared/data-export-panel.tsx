'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Calendar } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';

// =============================================================================
// DataExportPanel — Reusable export component for any module
// Usage: <DataExportPanel exportFn={fn} filename="purchases" requireDateRange />
// =============================================================================

interface DataExportPanelProps {
  /** Server action that fetches data for export */
  exportFn: (...args: any[]) => Promise<any[]>;
  /** Filename for the CSV download (without .csv extension) */
  filename: string;
  /** Whether date range is required (default: true) */
  requireDateRange?: boolean;
  /** Custom button label */
  label?: string;
}

export function DataExportPanel({
  exportFn,
  filename,
  requireDateRange = true,
  label = 'Export CSV',
}: DataExportPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // first day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const handleExport = () => {
    startTransition(async () => {
      try {
        const data = requireDateRange
          ? await exportFn(startDate, endDate)
          : await exportFn();

        if (!data || data.length === 0) {
          alert('ไม่มีข้อมูลในช่วงเวลาที่เลือก');
          return;
        }

        const dateRange = requireDateRange ? `-${startDate}-to-${endDate}` : '';
        downloadCSV(data, `${filename}${dateRange}`);
      } catch (error: any) {
        alert(error.message || 'เกิดข้อผิดพลาดในการ Export');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {requireDateRange && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-full sm:w-[130px] rounded-md border border-input bg-background px-2 py-1 text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <span className="text-muted-foreground text-sm shrink-0">ถึง</span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-full sm:w-[130px] rounded-md border border-input bg-background px-2 py-1 text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isPending}
        className="w-full sm:w-auto mt-1 sm:mt-0"
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-2 h-4 w-4" />
        )}
        {isPending ? 'กำลัง Export...' : label}
      </Button>
    </div>
  );
}
