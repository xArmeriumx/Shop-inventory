import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPurchase } from '@/actions/purchases/purchases.actions';
import { getShop } from '@/actions/core/shop.actions';
import { PurchaseDetailView } from '@/components/purchases/purchase-detail-view';
import Loading from '@/app/(dashboard)/loading';

interface PurchaseDetailsPageProps {
  params: { id: string };
}

async function PurchaseDetails({ id }: { id: string }) {
  const [purchaseRes, shopRes] = await Promise.all([
    getPurchase(id),
    getShop()
  ]);

  if (!purchaseRes.success) notFound();

  const purchase = purchaseRes.data;
  const shop = shopRes.success ? shopRes.data : null;

  return <PurchaseDetailView purchase={purchase} shop={shop} />;
}

export default function PurchaseDetailsPage(props: PurchaseDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseDetails id={props.params.id} />
    </Suspense>
  );
}
