import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/features/products/product-form';

export default function NewProductPage() {
  return (
    <div>
      <PageHeader
        title="เพิ่มสินค้าใหม่"
        description="กรอกข้อมูลเพื่อเพิ่มสินค้าใหม่เข้าระบบ"
      />

      <div className="max-w-2xl">
        <ProductForm />
      </div>
    </div>
  );
}
