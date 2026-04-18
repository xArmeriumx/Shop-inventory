import { Suspense } from 'react';
import { getShipments } from '@/actions/shipments';
import { ShipmentsTable } from '@/components/shipments/shipments-table';
import { ShipmentsToolbar } from '@/components/shipments/shipments-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { ShipmentStatsWidget } from '@/components/shipments/shipment-stats-widget';
import { SectionHeader } from '@/components/ui/section-header';

export const metadata = {
  title: 'จัดส่งสินค้า | Shop Inventory',
};

interface ShipmentsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

async function ShipmentsContent({ searchParams }: ShipmentsPageProps) {
  const params = await searchParams;
  const result = await getShipments({
    page: params.page ? Number(params.page) : 1,
    search: params.search,
    status: params.status,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  return (
    <div className="space-y-4">
      <ShipmentsToolbar
        defaultSearch={params.search}
        defaultStatus={params.status}
      />
      <ShipmentsTable
        shipments={result.data as any}
        pagination={result.pagination}
      />
    </div>
  );
}

function ShipmentsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default function ShipmentsPage(props: ShipmentsPageProps) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="จัดส่งสินค้า"
        description="จัดการรายการจัดส่งและติดตามพัสดุ"
      />

      <ShipmentStatsWidget />

      <Suspense fallback={<ShipmentsSkeleton />}>
        <ShipmentsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
