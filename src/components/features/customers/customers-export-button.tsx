'use client';

import { DataExportPanel } from '@/components/features/shared/data-export-panel';
import { exportCustomersData } from '@/actions/export';

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
