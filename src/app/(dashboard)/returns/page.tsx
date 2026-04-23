import { Suspense } from 'react';
import Link from 'next/link';
import { getReturns } from '@/actions/returns';
import { ReturnsTable } from '@/components/returns/returns-table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';
import { Guard } from '@/components/auth/guard';
import { ReturnsExportButton } from '@/components/returns/returns-export-button';
import { SectionHeader } from '@/components/ui/section-header';

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'คืนสินค้า | Shop Inventory',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReturnsPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

// ─── Data Fetcher ─────────────────────────────────────────────────────────────

async function ReturnsContent({ searchParams }: ReturnsPageProps) {
  const params = await searchParams;
  const result = await getReturns({
    page: params.page ? Number(params.page) : 1,
    search: params.search,
  });
  return <ReturnsTable returns={result.data as any} pagination={result.pagination} />;
}

function ReturnsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnsPage(props: ReturnsPageProps) {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="คืนสินค้า"
        description="จัดการรายการคืนสินค้าและคืนเงิน"
        action={
          <div className="flex flex-wrap gap-2">
            <ReturnsExportButton />
            <Guard permission="RETURN_CREATE">
              <Button asChild>
                <Link href="/returns/create">
                  <Plus className="h-4 w-4 mr-2" />คืนสินค้า
                </Link>
              </Button>
            </Guard>
          </div>
        }
      />

      <Suspense fallback={<ReturnsSkeleton />}>
        <ReturnsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
