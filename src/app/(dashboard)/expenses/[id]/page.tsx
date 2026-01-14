import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ExpenseForm } from '@/components/features/expenses/expense-form';
import { getExpense } from '@/actions/expenses';

interface EditExpensePageProps {
  params: { id: string };
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  let expense;

  try {
    expense = await getExpense(params.id);
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader title="แก้ไขค่าใช้จ่าย" description={expense.description} />
      <div className="max-w-2xl">
        <ExpenseForm expense={expense} />
      </div>
    </div>
  );
}
