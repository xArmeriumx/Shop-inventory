import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/features/products/product-form';
import { getProduct } from '@/actions/products';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/lookups';
import { StockService } from '@/lib/stock-service';
import { StockHistoryTable } from '@/components/features/products/stock-history-table';
import { StockAdjustmentDialog } from '@/components/features/products/stock-adjustment-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  let product;
  
  try {
    product = await getProduct(params.id);
  } catch {
    notFound();
  }

  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  // Fetch categories from DB
  const categories = await getLookupValues('PRODUCT_CATEGORY');

  // Fetch history
  const history = await StockService.getProductHistory(params.id);

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
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <div className="max-w-2xl">
              <ProductForm product={product} categories={categories} />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">ประวัติการเคลื่อนไหว</h3>
              <StockAdjustmentDialog 
                productId={product.id} 
                currentStock={product.stock}
              />
            </div>
            <StockHistoryTable logs={history} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
