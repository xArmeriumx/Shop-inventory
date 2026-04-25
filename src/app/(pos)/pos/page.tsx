'use client';

import { useEffect, useState } from 'react';
import dynamic_next from 'next/dynamic';
import { getProductsForPOS, getCategories, getPOSCustomers } from '@/lib/pos/pos-service';
import { getShop } from '@/actions/core/shop.actions';

// 🚀 POS Interface Design - Premium aesthetics & Modular Architecture
const POSInterface = dynamic_next(() => import('@/components/sales/pos/pos-interface').then(mod => mod.POSInterface), { 
  ssr: false,
  loading: () => <POSLoadingSkeleton />
});

/**
 * POS Page - Single Point of Entry
 * 🛡️ Build Stability: ใช้ Client-side Fetching เพื่อเลี่ยงปัญหา Next.js Build Worker 
 * พยายามรัน Server Logic ของ Auth ในช่วง Collect Page Data
 */
export default function POSPage() {
  const [data, setData] = useState<{ 
      products: any[], 
      categories: any[], 
      shop: any,
      customers: any[]
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsRes, categoriesRes, shopRes, customersRes] = await Promise.all([
          getProductsForPOS(),
          getCategories(),
          getShop(),
          getPOSCustomers()
        ]);

        if (productsRes.success && categoriesRes.success && shopRes.success) {
          setData({
            products: productsRes.data,
            categories: categoriesRes.data,
            shop: shopRes.data,
            customers: customersRes.success ? customersRes.data : []
          });
        } else {
          setError(productsRes.message || 'ไม่สามารถดึงข้อมูลพื้นฐานระบบ POS ได้');
        }
      } catch (err) {
        console.error('POS Bootstrap Error:', err);
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    }
    loadData();
  }, []);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-50">
        <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-2xl font-bold italic">!</span>
        </div>
        <h2 className="text-xl font-bold text-slate-800">Boot Error</h2>
        <p className="text-slate-500 max-w-sm">{error}</p>
        <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
        >
            Retry System Boot
        </button>
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
      initialCustomers={data.customers}
      shopData={data.shop}
    />
  );
}

function POSLoadingSkeleton() {
  return (
    <div className="h-screen w-screen bg-slate-900 flex flex-col items-center justify-center gap-6">
      <div className="relative">
          {/* Outer Ring */}
          <div className="h-20 w-20 border-4 border-slate-800 rounded-full" />
          {/* Inner Spinner */}
          <div className="absolute inset-0 h-20 w-20 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-white text-lg font-black tracking-[0.2em] animate-pulse">POS ENGINE</span>
        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Initializing Core Subsystems...</span>
      </div>
    </div>
  );
}
