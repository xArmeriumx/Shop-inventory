import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { IncomeForm } from '@/components/accounting/incomes/income-form';
import { getIncome } from '@/actions/accounting/income.actions';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

interface EditIncomePageProps {
  params: { id: string };
}

export default async function EditIncomePage({ params }: EditIncomePageProps) {
  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  let income;
  try {
    income = await getIncome(params.id);
  } catch {
    notFound();
  }

  // Fetch categories from DB
  const categories = await getLookupValues('INCOME_CATEGORY');

  return (
    <div>
      <PageHeader
        title="แก้ไขรายรับ"
        description={income.description || 'แก้ไขข้อมูลรายรับ'}
      />
      <div className="max-w-2xl">
        <IncomeForm income={income} categories={categories} />
      </div>
    </div>
  );
}
