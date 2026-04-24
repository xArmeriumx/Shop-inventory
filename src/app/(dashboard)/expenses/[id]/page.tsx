import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ExpenseForm } from '@/components/accounting/expenses/expense-form';
import { getExpense } from '@/actions/accounting/expense.actions';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

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

  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  // Fetch categories from DB
  const categories = await getLookupValues('EXPENSE_CATEGORY');

  return (
    <div>
      <PageHeader title="แก้ไขค่าใช้จ่าย" description={expense.description || undefined} />
      <div className="max-w-2xl">
        <ExpenseForm expense={expense} categories={categories} />
      </div>
    </div>
  );
}
