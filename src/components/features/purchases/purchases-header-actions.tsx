'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PurchaseScannerButton } from './purchase-scanner-button';
import { DataExportPanel } from '@/components/features/shared/data-export-panel';
import { exportPurchasesData } from '@/actions/export';

/**
 * Header actions for purchases page - includes scanner, export, and add button
 */
export function PurchasesHeaderActions() {
  return (
    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
      <DataExportPanel
        exportFn={exportPurchasesData}
        filename="purchases"
        label="Export"
      />
      <PurchaseScannerButton mode="list" variant="outline" />
      <Button asChild className="flex-1 sm:flex-none">
        <Link href="/purchases/new">
          <Plus className="mr-2 h-4 w-4" />
          บันทึกการซื้อ
        </Link>
      </Button>
    </div>
  );
}

