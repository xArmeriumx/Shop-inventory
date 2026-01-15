import { Suspense } from 'react';

import { getUserProfile } from '@/actions/settings';
import { getShop, createShopIfNotExists } from '@/actions/shop';
import { getLookupValuesForSettings, seedDefaultLookupValues } from '@/actions/lookups';
import { SettingsForm } from '@/components/features/settings/settings-form';
import Loading from '@/app/(dashboard)/loading';

async function SettingsContent() {
  // Fetch all data in parallel
  const [user, shop] = await Promise.all([
    getUserProfile(),
    createShopIfNotExists(),
  ]);

  // Seed default categories if needed
  await seedDefaultLookupValues();

  // Fetch categories
  const [productCategories, expenseCategories] = await Promise.all([
    getLookupValuesForSettings('PRODUCT_CATEGORY'),
    getLookupValuesForSettings('EXPENSE_CATEGORY'),
  ]);

  return (
    <SettingsForm 
      initialData={user} 
      shopData={shop} 
      productCategories={productCategories}
      expenseCategories={expenseCategories}
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
