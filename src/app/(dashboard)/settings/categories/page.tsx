import { Suspense } from 'react';
import { getLookupValuesForSettings } from '@/actions/core/lookups.actions';
import { CategorySettings } from '@/components/core/settings/category-settings';
import Loading from '@/app/(dashboard)/loading';

export default async function CategorySettingsPage() {
    const [productRes, expenseRes, incomeRes] = await Promise.all([
        getLookupValuesForSettings('PRODUCT_CATEGORY'),
        getLookupValuesForSettings('EXPENSE_CATEGORY'),
        getLookupValuesForSettings('INCOME_CATEGORY'),
    ]);

    const productCategories = productRes.success ? productRes.data : [];
    const expenseCategories = expenseRes.success ? expenseRes.data : [];
    const incomeCategories = incomeRes.success ? incomeRes.data : [];

    return (
        <Suspense fallback={<Loading />}>
            <CategorySettings
                productCategories={productCategories as any}
                expenseCategories={expenseCategories as any}
                incomeCategories={incomeCategories as any}
            />
        </Suspense>
    );
}
