import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { getCustomers } from '@/actions/customers';
import { CustomersTable } from '@/components/customers/customers-table';
import { CustomersToolbar } from '@/components/customers/customers-toolbar';
import { CustomersExportButton } from '@/components/customers/customers-export-button';

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
        <div className="flex gap-2">
          <CustomersExportButton />
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มลูกค้า
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <CustomersToolbar search={search} />
        <CustomersTable customers={customers} pagination={pagination} />
      </div>
    </div>
  );
}

