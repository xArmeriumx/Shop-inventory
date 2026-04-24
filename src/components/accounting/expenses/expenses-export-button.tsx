'use client';

import { DataExportPanel } from '@/components/shared/data-export-panel';
import { exportExpensesData } from '@/actions/core/export.actions';

export function ExpensesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportExpensesData}
      filename="expenses"
      requireDateRange={true}
    />
  );
}
