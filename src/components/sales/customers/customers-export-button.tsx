'use client';

import { DataExportPanel } from '@/components/ui/data-export-panel';
import { exportCustomersData } from '@/actions/core/export.actions';

export function CustomersExportButton() {
  return (
    <DataExportPanel
      exportFn={exportCustomersData}
      filename="customers"
      requireDateRange={false}
      label="Export"
    />
  );
}
