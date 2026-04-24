import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getExpenses } from '@/actions/accounting/expense.actions';
import { ExpensesTable } from '@/components/accounting/expenses/expenses-table';
import { ExpensesToolbar } from '@/components/accounting/expenses/expenses-toolbar';
import { ScanReceiptButton } from '@/components/accounting/expenses/scan-receipt-button';
import { ExpensesExportButton } from '@/components/accounting/expenses/expenses-export-button';

interface ExpensesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const category = searchParams.category || '';
  const startDate = searchParams.startDate;
  const endDate = searchParams.endDate;

  const result = await getExpenses({
    page,
    search,
    category,
    startDate,
    endDate,
  });

  const { data: expenses = [], pagination = { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } } = result.data || {};

  return (
    <div>
      <PageHeader title="ค่าใช้จ่าย" description="บันทึกและจัดการค่าใช้จ่าย">
        <div className="flex items-center gap-2">
          <ExpensesExportButton />
          <ScanReceiptButton />
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="mr-2 h-4 w-4" />
              บันทึกค่าใช้จ่าย
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <ExpensesToolbar
          search={search}
          category={category}
          startDate={startDate}
          endDate={endDate}
        />
        <ExpensesTable expenses={expenses} pagination={pagination} />
      </div>
    </div>
  );
}
