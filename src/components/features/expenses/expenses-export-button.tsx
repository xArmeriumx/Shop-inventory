'use client';

import { DataExportPanel } from '@/components/features/shared/data-export-panel';
import { exportExpensesData } from '@/actions/export';

export function ExpensesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportExpensesData}
      filename="expenses"
      requireDateRange={true}
    />
  );
}
