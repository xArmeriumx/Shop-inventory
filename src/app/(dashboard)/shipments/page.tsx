import { Suspense } from 'react';
import { getShipments } from '@/actions/sales/shipments.actions';
import { ShipmentsTable } from '@/components/sales/shipments/shipments-table';
import { ShipmentsToolbar } from '@/components/sales/shipments/shipments-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { ShipmentStatsWidget } from '@/components/sales/shipments/shipment-stats-widget';
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

  if (!result.success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-dashed">
        <h3 className="text-lg font-semibold">ไม่สามารถดึงข้อมูลรายการจัดส่งได้</h3>
        <p className="text-muted-foreground">{result.message}</p>
      </div>
    );
  }

  const shipments = result.data?.data || [];
  const pagination = result.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 0 };

  return (
    <div className="space-y-4">
      <ShipmentsToolbar
        defaultSearch={params.search}
        defaultStatus={params.status}
      />
      <ShipmentsTable
        shipments={shipments as any}
        pagination={pagination as any}
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
