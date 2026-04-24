'use client';

import { BarcodeLabel, BarcodePrintDialog } from './barcode-label';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useState } from 'react';

interface ProductBarcodeTabProps {
  product: {
    id: string;
    name: string;
    sku: string | null;
    salePrice: number;
  };
}

/**
 * Client component wrapper for the Barcode tab in the product detail page.
 * Shows barcode preview and a print button.
 */
export function ProductBarcodeTab({ product }: ProductBarcodeTabProps) {
  const [showPrint, setShowPrint] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">บาร์โค้ดสินค้า</h3>
        {product.sku && (
          <Button size="sm" onClick={() => setShowPrint(true)}>
            <Printer className="mr-2 h-4 w-4" />
            พิมพ์ Label
          </Button>
        )}
      </div>

      <BarcodeLabel product={product} />

      {product.sku && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• บาร์โค้ดจะถูกสร้างจาก SKU ของสินค้า (Code128)</p>
          <p>• สแกนด้วยเครื่องอ่านบาร์โค้ด USB เพื่อเพิ่มสินค้าในหน้าขาย</p>
          <p>• กดปุ่ม &ldquo;พิมพ์ Label&rdquo; เพื่อพิมพ์สติ๊กเกอร์</p>
        </div>
      )}

      {showPrint && (
        <BarcodePrintDialog
          products={[product]}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}
