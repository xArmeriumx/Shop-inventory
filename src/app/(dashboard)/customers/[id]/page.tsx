import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { CustomerForm } from '@/components/features/customers/customer-form';
import { getCustomer } from '@/actions/customers';

interface EditCustomerPageProps {
  params: { id: string };
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  let customer;

  try {
    customer = await getCustomer(params.id);
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader title="แก้ไขลูกค้า" description={customer.name} />
      <div className="max-w-2xl">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
