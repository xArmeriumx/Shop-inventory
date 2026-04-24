import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/inventory/products/product-form';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/core/lookups.actions';

export default async function NewProductPage() {
  // Seed default categories if needed
  await seedDefaultLookupValues();
  
  // Fetch categories from DB
  const categories = await getLookupValues('PRODUCT_CATEGORY');

  return (
    <div>
      <PageHeader
        title="เพิ่มสินค้าใหม่"
        description="กรอกข้อมูลเพื่อเพิ่มสินค้าใหม่เข้าระบบ"
      />

      <div className="max-w-2xl">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
