import { Suspense } from 'react';
import { getCustomers } from '@/actions/customers';
import { SectionHeader } from '@/components/ui/section-header';
import { CustomersToolbar } from '@/components/customers/customers-toolbar';
import { CustomerGrid } from '@/components/customers/customer-grid';
import { CustomersTable } from '@/components/customers/customers-table';
import { Skeleton } from '@/components/ui/skeleton';
import type { Customer } from '@prisma/client';

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

  const result = await getCustomers({
    page,
    search,
  });

  const customers = (result as any).items as Customer[];
  const pagination = {
    total: (result as any).totalCount || 0,
    page: (result as any).currentPage || page,
    limit: (result as any).pageSize || 30,
    totalPages: (result as any).totalPages || 1,
    hasNextPage: (result as any).currentPage < (result as any).totalPages,
    hasPrevPage: (result as any).currentPage > 1,
  };

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
              <CustomersTable customers={customers} pagination={pagination as any} />
            </div>
          ) : (
            <CustomerGrid customers={customers as any} pagination={pagination as any} />
          )}
        </Suspense>
      </div>
    </div>
  );
}
