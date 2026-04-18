import { notFound } from 'next/navigation';
import { getCustomerProfile } from '@/actions/customers';
import { CustomerProfile } from '@/components/customers/customer-profile';

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

  return <CustomerProfile data={data} />;
}
