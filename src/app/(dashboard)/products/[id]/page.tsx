import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/inventory/products/product-form';
import { getProduct } from '@/actions/inventory/products.actions';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';
import { getShop } from '@/actions/core/shop.actions';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductBarcodeTab } from '@/components/inventory/products/product-barcode-tab';
import { ProductHistoryTab } from '@/components/inventory/intelligence/product-history-tab';
import { ProductAuditTab } from '@/components/inventory/intelligence/product-audit-tab';
import { ProductWarehouseTab } from '@/components/inventory/products/product-warehouse-tab';

interface EditProductPageProps {
  params: {
    id: string;
  };
  searchParams: {
    historyPage?: string;
  };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  // Seed default categories if needed
  await seedDefaultLookupValues();

  const [response, categoriesRes, shopRes, warehousesRes] = await Promise.all([
    getProduct(params.id),
    getLookupValues('PRODUCT_CATEGORY'),
    getShop(),
    getWarehousesAction(),
  ]);

  if (!response.success || !response.data) {
    notFound();
  }

  const product = response.data;
  const categories = categoriesRes.success ? categoriesRes.data : [];
  const inventoryMode = (shopRes.success && shopRes.data?.inventoryMode) ? shopRes.data.inventoryMode : 'SIMPLE';
  const warehouses = warehousesRes.success ? warehousesRes.data : [];

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
            {inventoryMode !== 'SIMPLE' && (
              <TabsTrigger value="warehouse">สต็อกตามคลัง</TabsTrigger>
            )}
            <TabsTrigger value="audit">บันทึกการแก้ไข</TabsTrigger>
            <TabsTrigger value="barcode">บาร์โค้ด</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            <div className="max-w-2xl">
              <ProductForm
                product={product}
                categories={categories as any}
                inventoryMode={inventoryMode}
                warehouses={warehouses}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <ProductHistoryTab productId={params.id} />
          </TabsContent>

          {inventoryMode !== 'SIMPLE' && (
            <TabsContent value="warehouse">
              <ProductWarehouseTab productId={params.id} />
            </TabsContent>
          )}

          <TabsContent value="audit">
            <ProductAuditTab productId={params.id} />
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

