'use client';

import { DataExportPanel } from '@/components/shared/data-export-panel';
import { exportReturnsData } from '@/actions/export';

export function ReturnsExportButton() {
  return (
    <DataExportPanel
      exportFn={exportReturnsData}
      filename="returns"
      label="Export"
    />
  );
}
