import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getSales } from '@/actions/sales/sales.actions';
import { SalesTable } from '@/components/sales/sales-table';
import { SalesToolbar } from '@/components/sales/sales-toolbar';
import { SaleStatus } from '@/types/domain';
import { SalesExportButton } from '@/components/sales/sales-export-button';

import { Guard } from '@/components/core/auth/guard';

interface SalesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    channel?: string;
    status?: string;
    salesFlowMode?: string;
  };
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const startDate = searchParams.startDate || '';
  const endDate = searchParams.endDate || '';
  const paymentMethod = searchParams.paymentMethod || '';
  const channel = searchParams.channel || '';
  const status = searchParams.status as SaleStatus | undefined;

  const result = await getSales({
    page,
    search,
    startDate,
    endDate,
    paymentMethod,
    channel,
    status,
    salesFlowMode: searchParams.salesFlowMode as any,
  });

  const { data: sales = [], pagination = { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } } = result.data || {};

  const pageTitle = searchParams.salesFlowMode === 'ERP' 
    ? 'ใบสั่งขาย (Sales Orders)' 
    : searchParams.salesFlowMode === 'RETAIL' 
      ? 'ประวัติการขาย (Sales History)' 
      : 'ขายสินค้า (Orders)';

  return (
    <div>
      <PageHeader title={pageTitle} description="จัดการข้อมูลการขายและออกใบเสร็จ">
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <SalesExportButton />
          <Guard permission="SALE_CREATE">
            <Button asChild className="flex-1 sm:flex-none">
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

