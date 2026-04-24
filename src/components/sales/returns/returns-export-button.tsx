'use client';

import { DataExportPanel } from '@/components/shared/data-export-panel';
import { exportReturnsData } from '@/actions/core/export.actions';

export function ReturnsExportButton() {
  return (
    <DataExportPanel
      exportFn={exportReturnsData}
      filename="returns"
      label="Export"
    />
  );
}
