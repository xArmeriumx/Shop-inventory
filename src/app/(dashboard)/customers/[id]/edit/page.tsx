import { notFound } from 'next/navigation';
import { getCustomer } from '@/actions/customers';
import { CustomerForm } from '@/components/customers/customer-form';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface EditCustomerPageProps {
  params: { id: string };
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  let customer;

  try {
    customer = await getCustomer(params.id);
  } catch (error) {
    notFound();
  }

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="-ml-2 h-8 w-8">
              <Link href={`/customers/${params.id}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">แก้ไขข้อมูลลูกค้า</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            ระบุรายละเอียดที่ต้องการปรับปรุงสำหรับ {customer.name}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <CustomerForm customer={customer} />
      </div>
    </div>
  );
}
