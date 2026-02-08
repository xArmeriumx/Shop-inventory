'use client';

import { DataExportPanel } from '@/components/features/shared/data-export-panel';
import { exportIncomesData } from '@/actions/export';

export function IncomesExportButton() {
  return (
    <DataExportPanel
      exportFn={exportIncomesData}
      filename="incomes"
      label="Export"
    />
  );
}
