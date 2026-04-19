import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { th } from 'date-fns/locale';
import { getSale } from '@/actions/sales';
import { getShop } from '@/actions/shop';
import { formatCurrency } from '@/lib/formatters';
import { calculateCtn } from '@/lib/erp-utils';
import Loading from '@/app/(dashboard)/loading';

// A4 Print Styles
const printStyles = `
  @page {
    size: A4;
    margin: 20mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
    }
  }
`;

async function TaxInvoice({ id }: { id: string }) {
  const [sale, shop] = await Promise.all([
    getSale(id),
    getShop(),
  ]);

  if (!sale) {
    notFound();
  }

  const zonedDate = toZonedTime(sale.date, 'Asia/Bangkok');
  const customerName = sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป';
  const customerAddress = sale.customer?.address || '-';
  const customerTaxId = sale.customer?.taxId || '-';

  return (
    <div className="bg-white min-h-screen p-8 max-w-[210mm] mx-auto text-black">
      <style>{printStyles}</style>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-xl font-bold mb-2">{shop?.name || 'ชื่อร้านค้า'}</h1>
          <div className="text-sm space-y-1">
            <p>{shop?.address || 'ที่อยู่ร้านค้า'}</p>
            <p>โทร: {shop?.phone || '-'}</p>
            <p>เลขประจำตัวผู้เสียภาษี: {shop?.taxId || '-'}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold mb-2">ใบกำกับภาษี / ใบเสร็จรับเงิน</h2>
          <div className="text-sm space-y-1">
            <p className="font-semibold">ต้นฉบับ (Original)</p>
            <p>เลขที่: {sale.invoiceNumber}</p>
            <p>วันที่: {format(zonedDate, 'dd/MM/yyyy', { locale: th })}</p>
          </div>
        </div>
      </div>

      <hr className="border-black mb-6" />

      {/* Customer Info */}
      <div className="mb-8">
        <h3 className="font-bold mb-2 text-sm">ลูกค้า (Customer)</h3>
        <div className="text-sm space-y-1">
          <p><span className="font-semibold w-24 inline-block">ชื่อ:</span> {customerName}</p>
          <p><span className="font-semibold w-24 inline-block">ที่อยู่:</span> {customerAddress}</p>
          <p><span className="font-semibold w-24 inline-block">เลขผู้เสียภาษี:</span> {customerTaxId}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-sm mb-8 border-collapse">
        <thead>
          <tr className="border-b border-t border-black text-xs">
            <th className="py-2 text-left w-10">ลำดับ</th>
            <th className="py-2 text-left">รายการ</th>
            <th className="py-2 text-right w-24">หน่วยละ</th>
            <th className="py-2 text-right w-16">จำนวน</th>
            <th className="py-2 text-right w-12">Pack</th>
            <th className="py-2 text-right w-14">CTN</th>
            <th className="py-2 text-right w-24">รวมเงิน</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item: any, index: number) => (
            <tr key={item.id} className="border-b border-gray-100 text-xs">
              <td className="py-2 text-center">{index + 1}</td>
              <td className="py-2">
                <div>{item.product.name}</div>
                {item.product.sku && <div className="text-[10px] text-gray-500">SKU: {item.product.sku}</div>}
              </td>
              <td className="py-2 text-right">{formatCurrency(Number(item.salePrice))}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right text-gray-500">{item.packagingQty || 1}</td>
              <td className="py-2 text-right font-medium">
                {calculateCtn(item.quantity, item.packagingQty || 1)}
              </td>
              <td className="py-2 text-right">{formatCurrency(Number(item.subtotal))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer Totals */}
      <div className="flex justify-end mb-12">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>รวมเป็นเงิน</span>
            <span>{formatCurrency(Number(sale.totalAmount))}</span>
          </div>
          {/* Note: Simplified VAT calculation (assuming inclusive or 0 for now as per simple shop requirements) */}
          <div className="flex justify-between font-bold text-lg border-t border-black pt-2 mt-2">
            <span>จำนวนเงินทั้งสิ้น</span>
            <span>{formatCurrency(Number(sale.totalAmount))}</span>
          </div>
        </div>
      </div>

      {/* Text Amount (Optional but good for Tax Invoice) */}
      <div className="mb-12 border border-black p-2 text-center text-sm">
        ( {formatCurrency(Number(sale.totalAmount))} )
      </div>

      {/* Signature Area */}
      <div className="grid grid-cols-2 gap-8 mt-16 text-center text-sm">
        <div>
          <div className="border-b border-black mb-2 w-3/4 mx-auto"></div>
          <p>ผู้รับเงิน</p>
          <p className="text-xs text-muted-foreground mt-1">วันที่ ...../...../.....</p>
        </div>
        <div>
          <div className="border-b border-black mb-2 w-3/4 mx-auto"></div>
          <p>ผู้จ่ายเงิน</p>
          <p className="text-xs text-muted-foreground mt-1">วันที่ ...../...../.....</p>
        </div>
      </div>

    </div>
  );
}

export default function TaxInvoicePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Loading />}>
      <TaxInvoice id={params.id} />
    </Suspense>
  );
}
