'use client';

import { DataExportPanel } from '@/components/shared/data-export-panel';
import { exportIncomesData } from '@/actions/core/export.actions';

export function IncomesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportIncomesData}
      filename="incomes"
      label="Export"
    />
  );
}
