import { PageHeader } from '@/components/layout/page-header';
import { getPurchases } from '@/actions/purchases/purchases.actions';
import { PurchasesTable } from '@/components/purchases/purchases-table';
import { PurchasesToolbar } from '@/components/purchases/purchases-toolbar';
import { PurchaseStatus } from '@/types/domain';
import { PurchasesHeaderActions } from '@/components/purchases/purchases-header-actions';

interface PurchasesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: string;
  };
}

export default async function PurchasesPage({ searchParams }: PurchasesPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const startDate = searchParams.startDate || '';
  const endDate = searchParams.endDate || '';
  const paymentMethod = searchParams.paymentMethod || '';
  const status = searchParams.status as PurchaseStatus | undefined;

  const result = await getPurchases({
    page,
    search,
    startDate,
    endDate,
    paymentMethod,
    status,
  });

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed">
        <h3 className="text-lg font-semibold">ไม่สามารถดึงข้อมูลรายการซื้อได้</h3>
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  const { data: purchases = [], pagination = { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } } = result.data || {};

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

