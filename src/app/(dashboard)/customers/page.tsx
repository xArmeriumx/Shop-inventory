import { Suspense } from 'react';
import { getCustomers } from '@/actions/customers';
import { SectionHeader } from '@/components/ui/section-header';
import { CustomersToolbar } from '@/components/customers/customers-toolbar';
import { CustomerGrid } from '@/components/customers/customer-grid';
import { CustomersTable } from '@/components/customers/customers-table';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomersPageProps {
  searchParams: {
    page?: string;
    search?: string;
    view?: string;
  };
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const view = searchParams.view || 'grid';

  const { data: customers, pagination } = await getCustomers({
    page,
    search,
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="ลูกค้า"
        description="จัดการข้อมูลผู้ติดต่อและประวัติการซื้อ"
      />

      <div className="space-y-4">
        <CustomersToolbar initialSearch={search} />

        <Suspense fallback={<Skeleton className="w-full h-96 rounded-3xl" />}>
          {view === 'table' ? (
            <div className="bg-card rounded-3xl border shadow-sm overflow-hidden">
              <CustomersTable customers={customers} pagination={pagination} />
            </div>
          ) : (
            <CustomerGrid customers={customers as any} pagination={pagination} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

