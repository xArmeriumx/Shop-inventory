'use client';

import { useRef, useState } from 'react';
import { BarcodeCanvas } from '@/lib/barcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Download, X, Check } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductForLabel {
  id: string;
  name: string;
  sku: string | null;
  salePrice: number;
}

interface BarcodeLabelProps {
  product: ProductForLabel;
  showPrice?: boolean;
}

interface BarcodePrintDialogProps {
  products: ProductForLabel[];
  onClose: () => void;
}

// ─── Single Barcode Label ───────────────────────────────────────────────────

/**
 * Single barcode label — displays barcode + product name + price
 * For embedding in product detail page
 */
export function BarcodeLabel({ product, showPrice = true }: BarcodeLabelProps) {
  if (!product.sku) {
    return (
      <div className="text-sm text-muted-foreground italic p-4 border rounded-lg text-center">
        ไม่มี SKU — กรุณาเพิ่ม SKU เพื่อสร้างบาร์โค้ด
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-1 p-4 border rounded-lg bg-white">
      <BarcodeCanvas value={product.sku} height={40} width={1.5} fontSize={12} />
      <p className="text-xs font-medium text-center max-w-[200px] truncate">
        {product.name}
      </p>
      {showPrice && (
        <p className="text-sm font-bold">
          ฿{product.salePrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

// ─── Print Dialog (Batch Print) ─────────────────────────────────────────────

/**
 * Batch barcode print dialog
 * Shows preview of all labels and triggers browser print
 */
export function BarcodePrintDialog({ products, onClose }: BarcodePrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [showPrice, setShowPrice] = useState(true);
  const [columns, setColumns] = useState(3);
  const [copies, setCopies] = useState(1);

  const validProducts = products.filter(p => p.sku);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>พิมพ์บาร์โค้ด</title>
        <style>
          @page {
            margin: 5mm;
            size: A4;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, sans-serif;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            gap: 4px;
          }
          .label {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 6px 4px;
            border: 1px dashed #ccc;
            page-break-inside: avoid;
          }
          .label canvas {
            max-width: 100%;
          }
          .name {
            font-size: 9px;
            font-weight: 500;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            margin-top: 2px;
          }
          .price {
            font-size: 11px;
            font-weight: 700;
            margin-top: 1px;
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (validProducts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">พิมพ์บาร์โค้ด</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ไม่มีสินค้าที่มี SKU — กรุณาเพิ่ม SKU ให้สินค้าก่อนพิมพ์บาร์โค้ด
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expand by copies
  const labelsToRender: ProductForLabel[] = [];
  for (const p of validProducts) {
    for (let i = 0; i < copies; i++) {
      labelsToRender.push(p);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-auto">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-card z-10 border-b">
          <CardTitle className="text-base">
            พิมพ์บาร์โค้ด ({validProducts.length} รายการ)
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Settings */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="columns" className="text-muted-foreground">คอลัมน์:</label>
              <select
                id="columns"
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="h-8 rounded border border-input bg-background px-2 text-sm"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="copies" className="text-muted-foreground">จำนวนสำเนา:</label>
              <select
                id="copies"
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="h-8 rounded border border-input bg-background px-2 text-sm"
              >
                {[1, 2, 3, 5, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-muted-foreground">แสดงราคา</span>
            </label>
          </div>

          {/* Preview */}
          <div
            ref={printRef}
            className="border rounded-lg p-4 bg-white"
          >
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {labelsToRender.map((product, idx) => (
                <div
                  key={`${product.id}-${idx}`}
                  className="label flex flex-col items-center p-2 border border-dashed border-gray-300 rounded"
                >
                  <BarcodeCanvas
                    value={product.sku!}
                    height={35}
                    width={1.2}
                    fontSize={10}
                  />
                  <p className="name text-[9px] font-medium text-center max-w-full truncate mt-0.5">
                    {product.name}
                  </p>
                  {showPrice && (
                    <p className="price text-[11px] font-bold mt-0.5">
                      ฿{product.salePrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              พิมพ์ ({labelsToRender.length} label)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
