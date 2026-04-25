'use client';

import { useEffect, useState } from 'react';
import dynamic_next from 'next/dynamic';
import { getProductsForPOS, getCategories } from '@/lib/pos/pos-service';
import { getShop } from '@/actions/core/shop.actions';

const POSInterface = dynamic_next(() => import('@/components/sales/pos/pos-interface').then(mod => mod.POSInterface), { 
  ssr: false,
  loading: () => <POSLoadingSkeleton />
});

/**
 * POS Page - Client-Side Data Fetching for Build Stability
 */
export default function POSPage() {
  const [data, setData] = useState<{ products: any[], categories: any[], shop: any } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadData() {
      const [productsRes, categoriesRes, shopRes] = await Promise.all([
        getProductsForPOS(),
        getCategories(),
        getShop(),
      ]);

      if (productsRes.success && categoriesRes.success && shopRes.success) {
        setData({
          products: productsRes.data,
          categories: categoriesRes.data,
          shop: shopRes.data
        });
      } else {
        setError(true);
      }
    }
    loadData();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center p-6 text-center">
        <h2 className="text-xl font-semibold text-destructive">เกิดข้อผิดพลาดในการโหลดข้อมูล</h2>
      </div>
    );
  }

  if (!data) {
    return <POSLoadingSkeleton />;
  }

  return (
    <POSInterface
      initialProducts={data.products}
      categories={data.categories}
      promptPayId={data.shop?.promptPayId || undefined}
    />
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
