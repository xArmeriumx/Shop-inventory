import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getProducts } from '@/actions/inventory/products.actions';
import { getShop } from '@/actions/core/shop.actions';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { ProductsTable } from '@/components/inventory/products/products-table';
import { ProductsToolbar } from '@/components/inventory/products/products-toolbar';
import { ProductImportButton } from '@/components/inventory/products/product-import-button';
import { Guard } from '@/components/core/auth/guard';
import { StartStockTakeButton } from '@/components/inventory/products/start-stock-take-button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
    warehouseId?: string;
  }>;
}

// ─── Data Fetcher (wrapped in Suspense) ──────────────────────────────────────

async function ProductsContent({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || '';
  const category = params.category || '';
  const warehouseId = params.warehouseId || '';

  const [result, shopRes, warehousesRes] = await Promise.all([
    getProducts({ page, search, category, warehouseId }),
    getShop(),
    getWarehousesAction(),
  ]);

  if (!result.success || !result.data) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-md text-red-600 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        ไม่สามารถโหลดข้อมูลสินค้าได้: {result.success === false ? result.message : 'Unknown error'}
      </div>
    );
  }

  const { data: products, pagination } = result.data;
  const inventoryMode = (shopRes.success && shopRes.data?.inventoryMode) ? shopRes.data.inventoryMode : 'SIMPLE';
  const warehouses = warehousesRes.success ? warehousesRes.data : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <StartStockTakeButton
          productIds={(products as any[]).map((p: any) => p.id)}
          inventoryMode={inventoryMode}
          warehouses={warehouses}
        />
      </div>
      <ProductsToolbar
        search={search}
        category={category}
        warehouseId={warehouseId}
        warehouses={warehouses}
      />
      <ProductsTable products={products} pagination={pagination} />
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductsPage(props: ProductsPageProps) {

  return (
    <div className="space-y-6">
      <SectionHeader
        title="สินค้า"
        description="จัดการข้อมูลสินค้าและสต็อก"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700">
              <Link href="/products/low-stock">
                <AlertTriangle className="mr-2 h-4 w-4" />สินค้าใกล้หมด
              </Link>
            </Button>
            <ProductImportButton />
            <Guard permission="PRODUCT_CREATE">
              <Button asChild size="sm">
                <Link href="/products/new">
                  <Plus className="mr-2 h-4 w-4" />เพิ่มสินค้า
                </Link>
              </Button>
            </Guard>
          </div>
        }
      />

      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
