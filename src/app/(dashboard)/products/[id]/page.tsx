import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/products/product-form';
import { getProduct } from '@/actions/products';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/lookups';
import { StockService } from '@/services';
import { StockHistoryTableClientWrapper } from '@/components/products/stock-history-table-client-wrapper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductBarcodeTab } from '@/components/products/product-barcode-tab';

interface EditProductPageProps {
  params: {
    id: string;
  };
  searchParams: {
    historyPage?: string;
  };
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  let product;
  const historyPage = Number(searchParams.historyPage) || 1;
  const historyLimit = 20;
  
  try {
    product = await getProduct(params.id);
  } catch {
    notFound();
  }

  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  // Fetch categories from DB
  const categories = await getLookupValues('PRODUCT_CATEGORY');

  // Fetch history with pagination
  const { data: history, pagination } = await StockService.getProductHistory(params.id, historyPage, historyLimit);

  // We need a client wrapper to handle URL updates for pagination
  // Or we can simple use Link based approach if we don't want a client wrapper.
  // Actually, let's create a Client Component wrapper for the history table to handle router.push
  
  return (
    <div>
      <PageHeader
        title="แก้ไขสินค้า"
        description={product.name}
      />

      <div className="max-w-4xl">
        <Tabs defaultValue="edit" className="space-y-4">
          <TabsList>
            <TabsTrigger value="edit">ข้อมูลสินค้า</TabsTrigger>
            <TabsTrigger value="history">ประวัติสต็อก</TabsTrigger>
            <TabsTrigger value="barcode">บาร์โค้ด</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <div className="max-w-2xl">
              <ProductForm product={product} categories={categories} />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">ประวัติการเคลื่อนไหว</h3>
            </div>
            <StockHistoryTableClientWrapper logs={history} pagination={pagination} />
          </TabsContent>

          <TabsContent value="barcode">
            <ProductBarcodeTab
              product={{
                id: product.id,
                name: product.name,
                sku: product.sku || null,
                salePrice: Number(product.salePrice),
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

