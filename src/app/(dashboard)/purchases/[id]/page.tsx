import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getPurchase } from '@/actions/purchases';
import { getShop } from '@/actions/shop';
import { formatCurrency } from '@/lib/formatters';
import { getPurchaseStatusLabel, calculateCtn } from '@/lib/erp-utils';
import Loading from '@/app/(dashboard)/loading';
import { PrintButton } from '@/components/sales/print-button';
import { ReceiptImage } from '@/components/receipts/receipt-image';

interface PurchaseDetailsPageProps {
  params: {
    id: string;
  };
}

async function PurchaseDetails({ id }: { id: string }) {
  let purchase;
  let shop;
  
  try {
    [purchase, shop] = await Promise.all([
      getPurchase(id),
      getShop(),
    ]);
  } catch (error) {
    notFound();
  }

  if (!purchase) {
    notFound();
  }

  const zonedDate = toZonedTime(purchase.date, 'Asia/Bangkok');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/purchases">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">รายละเอียดการซื้อ</h1>
        </div>
        <PrintButton />
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="border-b print:border-none">
          {/* Shop Header */}
          <div className="text-center mb-4 print:mb-6">
            <h2 className="text-2xl font-bold">{shop?.name || 'ร้านค้า'}</h2>
            {shop?.address && (
              <p className="text-sm text-muted-foreground mt-1">{shop.address}</p>
            )}
            {shop?.phone && (
              <p className="text-sm text-muted-foreground">โทร: {shop.phone}</p>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">ใบรับสินค้า / Purchase Order</CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                รหัส: {purchase.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">
                วันที่: {format(zonedDate, 'dd MMMM yyyy', { locale: th })}
              </p>
              <p className="text-sm text-muted-foreground">
                เวลา: {format(zonedDate, 'HH:mm', { locale: th })} น.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Supplier Info */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">ข้อมูลผู้จำหน่าย</h3>
              {purchase.supplier ? (
                <>
                  <p className="text-sm font-medium">{purchase.supplier.name}</p>
                  {purchase.supplier.phone && (
                    <p className="text-sm text-muted-foreground">โทร: {purchase.supplier.phone}</p>
                  )}
                  {purchase.supplier.address && (
                    <p className="text-sm text-muted-foreground">{purchase.supplier.address}</p>
                  )}
                </>
              ) : purchase.supplierName ? (
                <p className="text-sm font-medium">{purchase.supplierName}</p>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่ระบุผู้จำหน่าย</p>
              )}
            </div>
            <div className="text-right">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {getPurchaseStatusLabel(purchase.status, purchase.docType as any)}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-md border mb-8 print:border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b print:bg-gray-100">
                <tr className="text-left">
                  <th className="p-3 font-medium">ลำดับ</th>
                  <th className="p-3 font-medium">รายการ</th>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 font-medium text-right">ราคาต่อหน่วย</th>
                  <th className="p-3 font-medium text-right">จำนวน (Unit)</th>
                  <th className="p-3 font-medium text-right">บรรจุภัณฑ์ (Pack)</th>
                  <th className="p-3 font-medium text-right">จำนวนกล่อง (CTN)</th>
                  <th className="p-3 font-medium text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item: any, index: number) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">{item.product.name}</td>
                    <td className="p-3 text-muted-foreground">{item.product.sku || '-'}</td>
                    <td className="p-3 text-right">{formatCurrency(Number(item.costPrice))}</td>
                    <td className="p-3 text-right font-medium">{item.quantity}</td>
                    <td className="p-3 text-right text-muted-foreground">{item.packagingQty || 1}</td>
                    <td className="p-3 text-right font-bold text-primary">
                      {calculateCtn(item.quantity, item.packagingQty || 1)}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(Number(item.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">ยอดรวมทั้งหมด</span>
                <span className="font-bold text-lg">{formatCurrency(Number(purchase.totalCost))}</span>
              </div>
            </div>
          </div>

          {purchase.notes && (
            <div className="mt-8 border-t pt-4">
              <h4 className="font-semibold mb-1 text-sm">หมายเหตุ:</h4>
              <p className="text-sm text-muted-foreground">{purchase.notes}</p>
            </div>
          )}

          {/* Receipt Image */}
          {purchase.receiptUrl && (
            <ReceiptImage 
              receiptUrl={purchase.receiptUrl} 
              alt="หลักฐานการซื้อ" 
            />
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
            <p>เอกสารนี้ออกโดยระบบอัตโนมัติ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PurchaseDetailsPage(props: PurchaseDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseDetails id={props.params.id} />
    </Suspense>
  );
}
