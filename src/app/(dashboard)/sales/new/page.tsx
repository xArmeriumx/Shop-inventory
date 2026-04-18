import { PageHeader } from '@/components/layout/page-header';
import { SaleForm } from '@/components/sales/sale-form';

import { requirePermission } from '@/lib/auth-guard';

export default async function NewSalePage() {
  await requirePermission('SALE_CREATE');
  return (
    <div>
      <PageHeader
        title="บันทึกการขาย"
        description="บันทึกรายการขายและออกใบเสร็จ"
      />

      <div className="max-w-4xl">
        <SaleForm />
      </div>
    </div>
  );
}
