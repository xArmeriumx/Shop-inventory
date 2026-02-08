import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getSales } from '@/actions/sales';
import { SalesTable } from '@/components/features/sales/sales-table';
import { SalesToolbar } from '@/components/features/sales/sales-toolbar';
import { SalesExportButton } from '@/components/features/sales/sales-export-button';

import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/auth/guard';

interface SalesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    channel?: string;
    status?: string;
  };
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requirePermission('SALE_VIEW');

  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;
  const paymentMethod = searchParams.paymentMethod;
  const channel = searchParams.channel;
  const status = searchParams.status;

  const { data: sales, pagination } = await getSales({
    page,
    search,
    startDate,
    endDate,
    paymentMethod,
    channel,
    status,
  });

  return (
    <div>
      <PageHeader title="ขายสินค้า" description="จัดการข้อมูลการขายและออกใบเสร็จ">
        <div className="flex items-center gap-2">
          <SalesExportButton />
          <Guard permission="SALE_CREATE">
            <Button asChild>
              <Link href="/sales/new">
                <Plus className="mr-2 h-4 w-4" />
                บันทึกการขาย
              </Link>
            </Button>
          </Guard>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <SalesToolbar
          search={search}
          startDate={startDate}
          endDate={endDate}
          paymentMethod={paymentMethod}
          channel={channel}
          status={status}
        />
        <SalesTable sales={sales} pagination={pagination} />
      </div>
    </div>
  );
}

