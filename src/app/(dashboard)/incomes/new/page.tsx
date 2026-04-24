import { PageHeader } from '@/components/layout/page-header';
import { IncomeForm } from '@/components/accounting/incomes/income-form';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

export default async function NewIncomePage() {
  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  // Fetch categories from DB
  const categories = await getLookupValues('INCOME_CATEGORY');

  return (
    <div>
      <PageHeader
        title="เพิ่มรายรับ"
        description="บันทึกรายรับใหม่จากบริการหรือรายได้อื่นๆ"
      />
      <div className="max-w-2xl">
        <IncomeForm categories={categories} />
      </div>
    </div>
  );
}
