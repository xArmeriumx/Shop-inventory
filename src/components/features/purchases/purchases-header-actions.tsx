'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PurchaseScannerButton } from './purchase-scanner-button';

/**
 * Header actions for purchases page - includes scanner and add button
 */
export function PurchasesHeaderActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <PurchaseScannerButton mode="list" variant="outline" />
      <Button asChild>
        <Link href="/purchases/new">
          <Plus className="mr-2 h-4 w-4" />
          บันทึกการซื้อ
        </Link>
      </Button>
    </div>
  );
}
