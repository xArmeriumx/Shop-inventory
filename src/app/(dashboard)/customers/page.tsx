import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getCustomers } from '@/actions/customers';
import { CustomersTable } from '@/components/features/customers/customers-table';
import { CustomersToolbar } from '@/components/features/customers/customers-toolbar';

interface CustomersPageProps {
  searchParams: {
    page?: string;
    search?: string;
  };
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || '';

  const { data: customers, pagination } = await getCustomers({
    page,
    search,
  });

  return (
    <div>
      <PageHeader title="ลูกค้า" description="จัดการข้อมูลลูกค้า">
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มลูกค้า
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <CustomersToolbar search={search} />
        <CustomersTable customers={customers} pagination={pagination} />
      </div>
    </div>
  );
}
