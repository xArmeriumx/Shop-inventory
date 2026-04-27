'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Package, Truck, Calendar, User, FileText, Warehouse as WarehouseIcon } from 'lucide-react';
import { PdfPrintTrigger } from '@/features/print/components/pdf-print-trigger';
import { PurchaseReceiptPrintBuilder } from '@/features/print/builders/purchase-receipt-print.builder';
import React from 'react';

interface ReceiptDetailViewProps {
  receipt: any;
  shop: any;
}

export function ReceiptDetailView({ receipt, shop }: ReceiptDetailViewProps) {
  // Use a ref-like approach or just build it here since it's a client component
  // In a real app we might use a hook, but here we can just project the data
  // for the print trigger.
  
  const printData = {
    docNumber: receipt.receiptNumber,
    docDate: new Date(receipt.receivedDate),
    poNumber: receipt.purchase?.purchaseNumber || '-',
    notes: receipt.notes || '',
    supplier: {
      name: receipt.purchase?.supplier?.name || 'Unknown',
      address: receipt.purchase?.supplier?.address || '',
      phone: receipt.purchase?.supplier?.phone || '',
      taxId: receipt.purchase?.supplier?.taxId || '',
    },
    requester: {
      name: shop.name || 'Shop',
      address: shop.address || '',
      phone: shop.phone || '',
      taxId: shop.taxId || '',
    },
    items: (receipt.lines || []).map((line: any) => ({
      name: line.product.name,
      sku: line.product.sku || '-',
      quantity: Number(line.quantity),
      uom: line.product.uom || 'ชิ้น',
      warehouse: line.warehouse.name,
    })),
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Action Bar */}
      <div className="flex justify-between items-center gap-3">
        <Button variant="outline" asChild size="sm">
          <Link href={`/purchases/${receipt.purchaseId}`}>
            <FileText className="w-4 h-4 mr-2" />
            ดูใบสั่งซื้อต้นฉบับ
          </Link>
        </Button>
        <PdfPrintTrigger
          type="PURCHASE_RECEIPT"
          documentData={printData}
          fileName={`GRN-${receipt.receiptNumber}.pdf`}
          label="พิมพ์ใบรับสินค้า (GRN)"
          variant="default"
          className="bg-primary text-primary-foreground shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Cards */}
        <Card className="md:col-span-2 shadow-md border-primary/5">
          <CardHeader className="bg-muted/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              ข้อมูลใบรับสินค้า
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">วันที่รับสินค้า</p>
                    <p className="font-semibold">{format(new Date(receipt.receivedDate), 'dd MMMM yyyy HH:mm', { locale: th })}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">ผู้รับสินค้า</p>
                    <p className="font-semibold">{receipt.user?.name || '-'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                 <div className="flex items-start gap-3">
                  <Truck className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">ใบสั่งซื้ออ้างอิง</p>
                    <p className="font-bold text-primary">{receipt.purchase?.purchaseNumber || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Package className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">ผู้จำหน่าย</p>
                    <p className="font-semibold">{receipt.purchase?.supplier?.name || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {receipt.notes && (
              <>
                <Separator className="my-6" />
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">หมายเหตุ</p>
                  <p className="text-sm italic text-foreground">{receipt.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Status & Summary Card */}
        <Card className="shadow-md border-primary/5 h-fit">
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-tighter text-muted-foreground">สรุปสถานะ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
              <span className="text-sm text-green-700 dark:text-green-400">สถานะเอกสาร</span>
              <Badge variant="success" className="bg-green-600">สำเร็จ</Badge>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">จำนวนรายการ</span>
                <span className="font-bold">{receipt.lines?.length || 0} รายการ</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">รวมจำนวนสินค้า</span>
                <span className="font-bold">
                  {receipt.lines?.reduce((sum: number, line: any) => sum + Number(line.quantity), 0)} หน่วย
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card className="shadow-lg overflow-hidden border-primary/5">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-lg">รายการสินค้าที่ได้รับ</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[80px]">ลำดับ</TableHead>
                <TableHead className="min-w-[200px]">สินค้า</TableHead>
                <TableHead className="text-right">จำนวนที่รับ</TableHead>
                <TableHead className="text-right">หน่วย</TableHead>
                <TableHead>คลังปลายทาง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(receipt.lines || []).map((line: any, index: number) => (
                <TableRow key={line.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-bold text-foreground">{line.product?.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{line.product?.sku || '-'}</div>
                  </TableCell>
                  <TableCell className="text-right font-black text-primary text-base">
                    {Number(line.quantity)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {line.product?.uom || 'ชิ้น'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 w-fit px-3 py-1 rounded-full border border-muted-foreground/10">
                      <WarehouseIcon className="w-3 h-3 opacity-60" />
                      {line.warehouse?.name}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
