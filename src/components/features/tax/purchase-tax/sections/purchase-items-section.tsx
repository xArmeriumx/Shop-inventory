'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Box, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PurchaseItemsSectionProps {
  items: any[];
}

export function PurchaseItemsSection({ items }: PurchaseItemsSectionProps) {
  return (
    <Card className="rounded-[2.5rem] border-primary/10 shadow-lg overflow-hidden">
      <CardHeader className="bg-muted/30 pb-6 border-b">
        <CardTitle className="text-md font-bold flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-background border flex items-center justify-center text-primary shadow-sm">
            <ShoppingBag className="h-4 w-4" />
          </div>
          สินค้าและบริการในใบรับ (Line Items)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/20">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 text-center text-[10px] font-bold uppercase tracking-wider">#</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider">Product Snapshot</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Qty</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Unit Price</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Taxable</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-primary">VAT</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                <TableCell className="text-center text-xs font-mono text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm tracking-tight">{item.productNameSnapshot}</span>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono flex items-center gap-1">
                          <Box className="h-2 w-2" />
                          {item.skuSnapshot || 'NO-SKU'}
                       </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{item.quantity} <span className="text-[10px] text-muted-foreground ml-1">{item.uomSnapshot}</span></TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(item.unitPrice))}</TableCell>
                <TableCell className="text-right font-bold text-gray-700">{formatCurrency(Number(item.taxableBaseAmount))}</TableCell>
                <TableCell className="text-right font-black text-primary">{formatCurrency(Number(item.taxAmount))}</TableCell>
                <TableCell className="text-right font-black">{formatCurrency(Number(item.lineNetAmount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {items.length === 0 && (
          <div className="p-12 text-center flex flex-col items-center justify-center opacity-40">
            <Info className="h-8 w-8 mb-2" />
            <p className="text-sm font-medium">ไม่มีรายการสินค้าในใบกำกับภาษีนี้</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
