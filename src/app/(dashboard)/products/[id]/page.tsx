import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/features/products/product-form';
import { getProduct } from '@/actions/products';

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

  return (
    <div>
      <PageHeader
        title="แก้ไขสินค้า"
        description={product.name}
      />

      <div className="max-w-2xl">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
