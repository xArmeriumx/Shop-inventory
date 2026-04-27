import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/inventory/products/product-form';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';
import { getShop } from '@/actions/core/shop.actions';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';

export default async function NewProductPage() {
  // Seed default categories if needed
  await seedDefaultLookupValues();

  // Fetch logic
  const [categoriesRes, shopRes, warehousesRes] = await Promise.all([
    getLookupValues('PRODUCT_CATEGORY'),
    getShop(),
    getWarehousesAction(),
  ]);

  const categories = categoriesRes.success ? categoriesRes.data : [];
  const inventoryMode = (shopRes.success && shopRes.data?.inventoryMode) ? shopRes.data.inventoryMode : 'SIMPLE';
  const warehouses = warehousesRes.success ? warehousesRes.data : [];

  return (
    <div>
      <PageHeader
        title="เพิ่มสินค้าใหม่"
        description="กรอกข้อมูลเพื่อเพิ่มสินค้าใหม่เข้าระบบ"
      />

      <div className="max-w-2xl">
        <ProductForm
          categories={categories as any}
          inventoryMode={inventoryMode}
          warehouses={warehouses}
        />
      </div>
    </div>
  );
}
