import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getSales } from '@/actions/sales';
import { SalesTable } from '@/components/features/sales/sales-table';
import { SalesToolbar } from '@/components/features/sales/sales-toolbar';

import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/auth/guard';

interface SalesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
  };
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requirePermission('SALE_VIEW');

  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;
  const paymentMethod = searchParams.paymentMethod;

  const { data: sales, pagination } = await getSales({
    page,
    search,
    startDate,
    endDate,
    paymentMethod,
  });

  return (
    <div>
      <PageHeader title="ขายสินค้า" description="จัดการข้อมูลการขายและออกใบเสร็จ">
        <Guard permission="SALE_CREATE">
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="mr-2 h-4 w-4" />
              บันทึกการขาย
            </Link>
          </Button>
        </Guard>
      </PageHeader>

      <div className="space-y-4">
        <SalesToolbar
          search={search}
          startDate={startDate}
          endDate={endDate}
          paymentMethod={paymentMethod}
        />
        <SalesTable sales={sales} pagination={pagination} />
      </div>
    </div>
  );
}
