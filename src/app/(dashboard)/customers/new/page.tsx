import { PageHeader } from '@/components/layout/page-header';
import { CustomerForm } from '@/components/customers/customer-form';

export default function NewCustomerPage() {
  return (
    <div>
      <PageHeader
        title="เพิ่มลูกค้าใหม่"
        description="กรอกข้อมูลลูกค้าใหม่"
      />
      <div className="max-w-2xl">
        <CustomerForm />
      </div>
    </div>
  );
}
