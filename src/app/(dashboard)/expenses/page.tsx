import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getExpenses } from '@/actions/expenses';
import { ExpensesTable } from '@/components/features/expenses/expenses-table';
import { ExpensesToolbar } from '@/components/features/expenses/expenses-toolbar';

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

  const { data: expenses, pagination } = await getExpenses({
    page,
    search,
    category,
    startDate,
    endDate,
  });

  return (
    <div>
      <PageHeader title="ค่าใช้จ่าย" description="บันทึกและจัดการค่าใช้จ่าย">
        <Button asChild>
          <Link href="/expenses/new">
            <Plus className="mr-2 h-4 w-4" />
            บันทึกค่าใช้จ่าย
          </Link>
        </Button>
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
