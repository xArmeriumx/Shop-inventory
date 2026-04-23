'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Guard } from '@/components/auth/guard';
import { CSVImportDialog } from './csv-import-dialog';

/**
 * Client-side wrapper for product page header actions.
 * Needed because the CSV Import Dialog requires client-side state.
 */
export function ProductImportButton() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <Guard permission="PRODUCT_CREATE">
        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="mr-2 h-4 w-4" />
          นำเข้า CSV
        </Button>
      </Guard>

      {showImport && (
        <CSVImportDialog
          open={showImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  );
}
