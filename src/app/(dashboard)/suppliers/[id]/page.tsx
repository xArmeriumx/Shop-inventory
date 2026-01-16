import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { SupplierForm } from '@/components/features/suppliers/supplier-form';
import { getSupplier } from '@/actions/suppliers';

interface EditSupplierPageProps {
  params: { id: string };
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  let supplier;

  try {
    supplier = await getSupplier(params.id);
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader title="แก้ไขผู้จำหน่าย" description={supplier.name} />
      <div className="max-w-2xl">
        <SupplierForm supplier={supplier} />
      </div>
    </div>
  );
}
