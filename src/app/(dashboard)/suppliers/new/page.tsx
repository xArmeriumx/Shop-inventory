import { PageHeader } from '@/components/layout/page-header';
import { SupplierForm } from '@/components/purchases/suppliers/supplier-form';

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader
        title="เพิ่มผู้จำหน่ายใหม่"
        description="กรอกข้อมูลผู้จำหน่ายใหม่"
      />
      <div className="max-w-2xl">
        <SupplierForm />
      </div>
    </div>
  );
}
