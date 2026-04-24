import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPurchaseTax } from '@/actions/tax/tax.actions';
import { PurchaseTaxDetail } from '@/components/tax/purchase-tax-detail';
import Loading from '@/app/(dashboard)/loading';

interface PurchaseTaxDetailPageProps {
    params: { id: string };
}

async function DetailWrapper({ id }: { id: string }) {
    const res = await getPurchaseTax(id);

    if (!res.success || !res.data) {
        notFound();
    }

    return <PurchaseTaxDetail doc={res.data} />;
}

export default function PurchaseTaxDetailPage(props: PurchaseTaxDetailPageProps) {
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<Loading />}>
                <DetailWrapper id={props.params.id} />
            </Suspense>
        </div>
    );
}
