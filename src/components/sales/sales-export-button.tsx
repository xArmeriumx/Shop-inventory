'use client';

import { DataExportPanel } from '@/components/ui/data-export-panel';
import { exportSalesData } from '@/actions/core/export.actions';

export function SalesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportSalesData}
      filename="sales"
      requireDateRange={true}
    />
  );
}
