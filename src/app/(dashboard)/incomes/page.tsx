import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getIncomes } from '@/actions/incomes';
import { IncomesTable } from '@/components/incomes/incomes-table';
import { IncomesToolbar } from '@/components/incomes/incomes-toolbar';
import { IncomesExportButton } from '@/components/incomes/incomes-export-button';

interface IncomesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function IncomesPage({ searchParams }: IncomesPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const category = searchParams.category || '';
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;

  const { data: incomes, pagination } = await getIncomes({
    page,
    search,
    category,
    startDate,
    endDate,
  });

  return (
    <div>
      <PageHeader title="รายรับอื่นๆ" description="บันทึกรายรับจากบริการและรายได้อื่นที่ไม่ใช่การขายสินค้า">
        <div className="flex gap-2">
          <IncomesExportButton />
          <Button asChild>
            <Link href="/incomes/new">
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มรายรับ
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <IncomesToolbar
          search={search}
          category={category}
          startDate={startDate}
          endDate={endDate}
        />
        <IncomesTable incomes={incomes} pagination={pagination} />
      </div>
    </div>
  );
}

