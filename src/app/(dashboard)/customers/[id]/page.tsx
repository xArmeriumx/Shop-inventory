import { notFound } from 'next/navigation';
import { getCustomerProfile } from '@/actions/sales/customers.actions';
import { CustomerProfile } from '@/components/sales/customers/customer-profile';

interface CustomerPageProps {
  params: { id: string };
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  let data;

  try {
    data = await getCustomerProfile(params.id);
  } catch {
    notFound();
  }

  if (!data) notFound();

  return <CustomerProfile data={data as any} />;
}
