import { Suspense } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { SectionHeader } from '@/components/ui/section-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getProducts } from '@/actions/products';
import { ProductsTable } from '@/components/products/products-table';
import { ProductsToolbar } from '@/components/products/products-toolbar';
import { ProductImportButton } from '@/components/products/product-import-button';
import { Guard } from '@/components/auth/guard';
import { StartStockTakeButton } from '@/components/products/start-stock-take-button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    category?: string;
  }>;
}

// ─── Data Fetcher (wrapped in Suspense) ──────────────────────────────────────

async function ProductsContent({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || '';
  const category = params.category || '';

  const { data: products, pagination } = await getProducts({ page, search, category });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <StartStockTakeButton productIds={products.map(p => p.id)} />
      </div>
      <ProductsToolbar search={search} category={category} />
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
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700">
              <Link href="/products/low-stock">
                <AlertTriangle className="mr-2 h-4 w-4" />สินค้าใกล้หมด
              </Link>
            </Button>
            <ProductImportButton />
            <Guard permission="PRODUCT_CREATE">
              <Button asChild>
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
