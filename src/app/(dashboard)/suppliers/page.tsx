import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getSuppliers } from '@/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { SuppliersTable } from '@/components/suppliers/suppliers-table';

interface PageProps {
  searchParams: { page?: string; search?: string };
}

async function SuppliersContent({ searchParams }: PageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const { data: suppliers, pagination } = await getSuppliers({ page, search, limit: 20 });
  return <SuppliersTable suppliers={suppliers} pagination={pagination} search={search} />;
}

function SuppliersLoading() {
  return (
    <Card>
      <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
      <CardContent><div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div></CardContent>
    </Card>
  );
}

export default function SuppliersPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="ผู้จำหน่าย"
        description="จัดการข้อมูลผู้จำหน่ายและประวัติการสั่งซื้อ"
        action={
          <Button asChild>
            <Link href="/suppliers/new"><Plus className="h-4 w-4 mr-2" />เพิ่มผู้จำหน่าย</Link>
          </Button>
        }
      />
      <Suspense fallback={<SuppliersLoading />}>
        <SuppliersContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
