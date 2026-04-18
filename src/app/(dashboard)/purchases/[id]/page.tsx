import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPurchase } from '@/actions/purchases';
import { getShop } from '@/actions/shop';
import { PurchaseDetailView } from '@/components/purchases/purchase-detail-view';
import Loading from '@/app/(dashboard)/loading';

interface PurchaseDetailsPageProps {
  params: { id: string };
}

async function PurchaseDetails({ id }: { id: string }) {
  let purchase, shop;
  try {
    [purchase, shop] = await Promise.all([getPurchase(id), getShop()]);
  } catch {
    notFound();
  }
  if (!purchase) notFound();

  return <PurchaseDetailView purchase={purchase} shop={shop} />;
}

export default function PurchaseDetailsPage(props: PurchaseDetailsPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <PurchaseDetails id={props.params.id} />
    </Suspense>
  );
}
