import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ProductForm } from '@/components/features/products/product-form';
import { getProduct } from '@/actions/products';
import { getLookupValues, seedDefaultLookupValues } from '@/actions/lookups';

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

  return (
    <div>
      <PageHeader
        title="แก้ไขสินค้า"
        description={product.name}
      />

      <div className="max-w-2xl">
        <ProductForm product={product} categories={categories} />
      </div>
    </div>
  );
}
