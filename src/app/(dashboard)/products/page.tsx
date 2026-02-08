import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getProducts } from '@/actions/products';
import { ProductsTable } from '@/components/features/products/products-table';
import { ProductsToolbar } from '@/components/features/products/products-toolbar';
import { ProductImportButton } from '@/components/features/products/product-import-button';

import { requirePermission } from '@/lib/auth-guard';
import { Guard } from '@/components/auth/guard';

interface ProductsPageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requirePermission('PRODUCT_VIEW');
  
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';
  const category = searchParams.category || '';

  const { data: products, pagination } = await getProducts({
    page,
    search,
    category,
  });

  return (
    <div>
      <PageHeader title="สินค้า" description="จัดการข้อมูลสินค้าและสต็อก">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700">
            <Link href="/products/low-stock">
              <AlertTriangle className="mr-2 h-4 w-4" />
              สินค้าใกล้หมด
            </Link>
          </Button>
          <ProductImportButton />
          <Guard permission="PRODUCT_CREATE">
            <Button asChild>
              <Link href="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มสินค้า
              </Link>
            </Button>
          </Guard>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <ProductsToolbar search={search} category={category} />
        <ProductsTable products={products} pagination={pagination} />
      </div>
    </div>
  );
}
