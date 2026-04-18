import { Suspense } from 'react';
import { getUserProfile } from '@/actions/settings';
import { getShop } from '@/actions/shop';
import { getLookupValuesForSettings, seedDefaultLookupValues } from '@/actions/lookups';
import { LookupValue } from '@prisma/client';
import { SettingsForm } from '@/components/settings/settings-form';
import { SectionHeader } from '@/components/ui/section-header';
import Loading from '@/app/(dashboard)/loading';

async function SettingsContent() {
  try { await seedDefaultLookupValues(); } catch { /* Ignore permission error */ }

  const [user, shop, productCategories, expenseCategories, incomeCategories] = await Promise.all([
    getUserProfile(),
    getShop(),
    getLookupValuesForSettings('PRODUCT_CATEGORY'),
    getLookupValuesForSettings('EXPENSE_CATEGORY'),
    getLookupValuesForSettings('INCOME_CATEGORY'),
  ]);

  return (
    <SettingsForm
      initialData={user}
      shopData={shop}
      productCategories={productCategories}
      expenseCategories={expenseCategories}
      incomeCategories={incomeCategories}
    />
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="ตั้งค่า" description="ข้อมูลบัญชีและร้านค้าของคุณ" />
      <Suspense fallback={<Loading />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
