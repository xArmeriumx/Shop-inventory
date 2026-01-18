import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { ArrowLeft, Store } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getSale } from '@/actions/sales';
import { getShop } from '@/actions/shop';
import { formatCurrency } from '@/lib/formatters';
import Loading from '@/app/(dashboard)/loading';
import { PrintButton } from '@/components/features/sales/print-button';
import { ReceiptImage } from '@/components/features/receipts/receipt-image';

export interface SaleDetailsPageProps {
  params: {
    id: string;
  };
}

import { Metadata } from 'next';
export async function generateMetadata({ params }: SaleDetailsPageProps): Promise<Metadata> {
  try {
    const sale = await getSale(params.id);
    if (!sale) {
      return {
        title: 'ไม่พบข้อมูลการขาย',
      };
    }
    return {
      title: `บิลเลขที่ ${sale.invoiceNumber}`,
      description: `รายละเอียดการขาย ${sale.invoiceNumber} ลูกค้า ${sale.customerName || 'ทั่วไป'} ยอดรวม ${Number(sale.totalAmount).toFixed(2)} บาท`,
    };
  } catch (error) {
    return {
      title: 'รายละเอียดการขาย',
    };
  }
}

import { requirePermission } from '@/lib/auth-guard';

async function SaleDetails({ id }: { id: string }) {
  await requirePermission('SALE_VIEW');

  const [sale, shop] = await Promise.all([
    getSale(id),
    getShop(),
  ]);

  if (!sale) {
    notFound();
  }

  const zonedDate = toZonedTime(sale.date, 'Asia/Bangkok');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/sales">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">รายละเอียดการขาย</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/sales/${id}/tax-invoice`} target="_blank" rel="noopener noreferrer">
              พิมพ์ใบกำกับภาษี (A4)
            </a>
          </Button>
          <PrintButton />
        </div>
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
            {shop?.taxId && (
              <p className="text-sm text-muted-foreground">เลขประจำตัวผู้เสียภาษี: {shop.taxId}</p>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">ใบเสร็จรับเงิน / Receipt</CardTitle>
              <p className="text-muted-foreground text-sm mt-1">
                เลขที่: {sale.invoiceNumber}
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
          {/* Customer Info */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">ข้อมูลลูกค้า</h3>
              <p className="text-sm">{sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป'}</p>
              {sale.customer && (
                <>
                  <p className="text-sm text-muted-foreground">{sale.customer.address}</p>
                  <p className="text-sm text-muted-foreground">{sale.customer.phone}</p>
                </>
              )}
            </div>
            <div className="text-right">
              <h3 className="font-semibold mb-2">วิธีการชำระเงิน</h3>
              <p className="text-sm">
                {sale.paymentMethod === 'CASH' ? 'เงินสด' : 'เงินโอน/QR'}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-md border mb-8 print:border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b print:bg-gray-100">
                <tr className="text-left">
                  <th className="p-3 font-medium">ลำดับ</th>
                  <th className="p-3 font-medium">รายการ</th>
                  <th className="p-3 font-medium text-right">ราคาต่อหน่วย</th>
                  <th className="p-3 font-medium text-right">จำนวน</th>
                  <th className="p-3 font-medium text-right">รวม</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item: any, index: number) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3">{item.product.name}</td>
                    <td className="p-3 text-right">{formatCurrency(Number(item.salePrice))}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
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
                <span className="font-bold text-lg">{formatCurrency(Number(sale.totalAmount))}</span>
              </div>
            </div>
          </div>

          {sale.notes && (
            <div className="mt-8 border-t pt-4">
              <h4 className="font-semibold mb-1 text-sm">หมายเหตุ:</h4>
              <p className="text-sm text-muted-foreground">{sale.notes}</p>
            </div>
          )}

          {/* Receipt Image */}
          {sale.receiptUrl && (
            <ReceiptImage 
              receiptUrl={sale.receiptUrl} 
              alt="หลักฐานการขาย" 
            />
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
            <p>ขอบคุณที่ใช้บริการ</p>
            {shop?.name && <p className="font-medium">{shop.name}</p>}
          </div>
        </CardContent>
      </Card>
      
    </div>
  );
}

export default function SaleDetailsPage(props: SaleDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <SaleDetails id={props.params.id} />
    </Suspense>
  );
}
