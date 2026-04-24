import { Suspense } from 'react';
import { POSInterface } from '@/components/sales/pos/pos-interface';
import { getProductsForPOS, getCategories } from '@/lib/pos/pos-service';
import { getShop } from '@/actions/core/shop.actions';

/**
 * POS Page - Main point of sale interface
 * Server component that fetches initial data
 */
export default async function POSPage() {
  const [products, categories, shopRes] = await Promise.all([
    getProductsForPOS(),
    getCategories(),
    getShop(),
  ]);

  const shop = shopRes.success ? shopRes.data : null;

  return (
    <Suspense fallback={<POSLoadingSkeleton />}>
      <POSInterface
        initialProducts={products}
        categories={categories}
        promptPayId={shop?.promptPayId || undefined}
      />
    </Suspense>
  );
}

function POSLoadingSkeleton() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        กำลังโหลดระบบ POS...
      </div>
    </div>
  );
}
