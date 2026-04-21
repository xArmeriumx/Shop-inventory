import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { type Metadata } from 'next';
import { getSale } from '@/actions/sales';
import { getShop } from '@/actions/shop';
import { SaleDetailView } from '@/components/sales/sale-detail-view';
import { getPaymentHistoryAction } from '@/actions/payments';
import Loading from '@/app/(dashboard)/loading';

interface SaleDetailsPageProps {
  params: { id: string };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: SaleDetailsPageProps): Promise<Metadata> {
  try {
    const sale = await getSale(params.id);
    if (!sale) return { title: 'ไม่พบข้อมูลการขาย' };
    return {
      title: `บิลเลขที่ ${sale.invoiceNumber}`,
      description: `รายละเอียดการขาย ${sale.invoiceNumber} ลูกค้า ${sale.customer?.name || sale.customerName || 'ทั่วไป'}`,
    };
  } catch {
    return { title: 'รายละเอียดการขาย' };
  }
}

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function SaleDetails({ id }: { id: string }) {
  const [sale, shop, paymentsRes] = await Promise.all([
    getSale(id),
    getShop(),
    getPaymentHistoryAction({ saleId: id })
  ]);

  if (!sale) notFound();

  return <SaleDetailView sale={sale} shop={shop} payments={paymentsRes.success ? paymentsRes.data : []} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SaleDetailsPage(props: SaleDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <SaleDetails id={props.params.id} />
    </Suspense>
  );
}
