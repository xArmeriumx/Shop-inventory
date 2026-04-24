import { Suspense } from 'react';
import { getSuppliers } from '@/actions/purchases/suppliers.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/ui/section-header';
import { SuppliersToolbar } from '@/components/purchases/suppliers/suppliers-toolbar';
import { SupplierGrid } from '@/components/purchases/suppliers/supplier-grid';
import { SuppliersTable } from '@/components/purchases/suppliers/suppliers-table';

interface PageProps {
  searchParams: { page?: string; search?: string; view?: 'grid' | 'table' };
}

async function SuppliersContent({ searchParams }: PageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const view = searchParams.view || 'grid';
  const { data: suppliers, pagination } = await getSuppliers({ page, search, limit: 20 });

  return (
    <div className="space-y-6">
      <SuppliersToolbar initialSearch={search} />

      {view === 'grid' ? (
        <SupplierGrid suppliers={suppliers as any} pagination={pagination} />
      ) : (
        <SuppliersTable suppliers={suppliers as any} pagination={pagination} search={search} />
      )}
    </div>
  );
}

function SuppliersLoading() {
  return (
    <div className="space-y-6">
      <div className="h-20 w-full bg-muted animate-pulse rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function SuppliersPage({ searchParams }: PageProps) {
  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
      <SectionHeader
        title="ผู้จำหน่าย"
        description="จัดการข้อมูลผู้จำหน่ายและประวัติการสั่งซื้อสะสม"
      />

      <Suspense fallback={<SuppliersLoading />}>
        <SuppliersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
