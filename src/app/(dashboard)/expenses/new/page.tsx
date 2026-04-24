import { PageHeader } from '@/components/layout/page-header';
import { ExpenseForm } from '@/components/accounting/expenses/expense-form';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

export default async function NewExpensePage() {
  // Seed default categories if needed
  await seedDefaultLookupValues();

  // Fetch categories from DB
  const categoriesRes = await getLookupValues('EXPENSE_CATEGORY');
  const categories = categoriesRes.success ? categoriesRes.data : [];

  return (
    <div>
      <PageHeader
        title="บันทึกค่าใช้จ่าย"
        description="เพิ่มรายการค่าใช้จ่ายใหม่"
      />
      <div className="max-w-2xl">
        <ExpenseForm categories={categories as any} />
      </div>
    </div>
  );
}
