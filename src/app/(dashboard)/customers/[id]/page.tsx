import { notFound } from 'next/navigation';
import { getCustomerProfile } from '@/actions/sales/customers.actions';
import { CustomerProfile } from '@/components/sales/customers/customer-profile';

interface CustomerPageProps {
  params: { id: string };
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const res = await getCustomerProfile(params.id);

  if (!res.success || !res.data) {
    notFound();
  }

}
