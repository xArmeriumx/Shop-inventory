import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { type Metadata } from 'next';
import { getSale } from '@/actions/sales/sales.actions';
import { getShop } from '@/actions/core/shop.actions';
import { SaleDetailView } from '@/components/sales/sale-detail-view';
import { getPaymentHistoryAction } from '@/actions/accounting/payments.actions';
import Loading from '@/app/(dashboard)/loading';

interface SaleDetailsPageProps {
  params: { id: string };
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: SaleDetailsPageProps): Promise<Metadata> {
  try {
    const result = await getSale(params.id);
    if (!result.success || !result.data) {
      notFound();
    }
    const sale = result.data;
    return {
      title: sale.invoiceNumber?.startsWith('SO-') ? `ใบสั่งขายเลขที่ ${sale.invoiceNumber}` : `บิลเลขที่ ${sale.invoiceNumber}`,
      description: `รายละเอียดการขาย ${sale.invoiceNumber} ลูกค้า ${sale.customerName || 'ทั่วไป'}`,
    };
  } catch {
    return { title: 'รายละเอียดการขาย' };
  }
}

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function SaleDetails({ id }: { id: string }) {
  const [saleRes, shopRes, paymentsRes] = await Promise.all([
    getSale(id),
    getShop(),
    getPaymentHistoryAction({ saleId: id })
  ]);

  if (!saleRes.success) notFound();

  const sale = saleRes.data;
  const shop = shopRes.success ? shopRes.data : null;
  const payments = paymentsRes.success ? paymentsRes.data : [];

  return <SaleDetailView sale={sale} shop={shop} payments={payments} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SaleDetailsPage(props: SaleDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <SaleDetails id={props.params.id} />
    </Suspense>
  );
}
