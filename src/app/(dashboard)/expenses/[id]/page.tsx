import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ExpenseForm } from '@/components/accounting/expenses/expense-form';
import { getExpense } from '@/actions/accounting/expense.actions';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

interface EditExpensePageProps {
  params: { id: string };
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const result = await getExpense(params.id);
  if (!result.success || !result.data) {
    notFound();
  }
  const expense = result.data;

  // Seed default categories if needed
  await seedDefaultLookupValues();

  // Fetch categories from DB
  const categoriesRes = await getLookupValues('EXPENSE_CATEGORY');
  const categories = categoriesRes.success ? categoriesRes.data : [];

  return (
    <div>
      <PageHeader title="แก้ไขค่าใช้จ่าย" description={expense.description || undefined} />
      <div className="max-w-2xl">
        <ExpenseForm expense={expense} categories={categories as any} />
      </div>
    </div>
  );
}
