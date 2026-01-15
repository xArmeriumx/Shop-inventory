import { Suspense } from 'react';
import { POSInterface } from '@/components/features/pos/pos-interface';
import { getProductsForPOS, getCategories } from '@/lib/pos/pos-service';

/**
 * POS Page - Main point of sale interface
 * Server component that fetches initial data
 */
export default async function POSPage() {
  const [products, categories] = await Promise.all([
    getProductsForPOS(),
    getCategories(),
  ]);

  return (
    <Suspense fallback={<POSLoadingSkeleton />}>
      <POSInterface 
        initialProducts={products} 
        categories={categories} 
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
