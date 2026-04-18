import { Suspense } from 'react';

import { getUserProfile } from '@/actions/settings';
import { getShop } from '@/actions/shop';
import { getLookupValuesForSettings, seedDefaultLookupValues } from '@/actions/lookups';
import { LookupValue } from '@prisma/client';
import { SettingsForm } from '@/components/settings/settings-form';
import Loading from '@/app/(dashboard)/loading';

async function SettingsContent() {
  // Seed default categories if needed (ignore permission error)
  try {
    await seedDefaultLookupValues();
  } catch (error) {
    // Ignore permission error
  }

  // Fetch all data in parallel
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
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">ตั้งค่า</h1>
      </div>
      
      <Suspense fallback={<Loading />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
