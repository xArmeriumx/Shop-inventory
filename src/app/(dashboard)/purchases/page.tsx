import { PageHeader } from '@/components/layout/page-header';
import { getPurchases } from '@/actions/purchases';
import { PurchasesTable } from '@/components/features/purchases/purchases-table';
import { PurchasesToolbar } from '@/components/features/purchases/purchases-toolbar';
import { PurchasesHeaderActions } from '@/components/features/purchases/purchases-header-actions';

interface PurchasesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
  };
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;
  const paymentMethod = searchParams.paymentMethod;

  const { data: purchases, pagination } = await getPurchases({
    page,
    search,
    startDate,
    endDate,
    paymentMethod,
  });

  return (
    <div>
      <PageHeader title="ซื้อสินค้า" description="บันทึกการซื้อและเติมสต็อกสินค้า">
        <PurchasesHeaderActions />
      </PageHeader>

      <div className="space-y-4">
        <PurchasesToolbar
          search={search}
          startDate={startDate}
          endDate={endDate}
          paymentMethod={paymentMethod}
        />
        <PurchasesTable purchases={purchases} pagination={pagination} />
      </div>
    </div>
  );
}

