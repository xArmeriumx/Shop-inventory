'use client';

import { DataExportPanel } from '@/components/shared/data-export-panel';
import { exportSalesData } from '@/actions/export';

export function SalesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportSalesData}
      filename="sales"
      requireDateRange={true}
    />
  );
}
