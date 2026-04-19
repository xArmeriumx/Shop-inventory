import { PageHeader } from '@/components/layout/page-header';
import { SaleForm } from '@/components/sales/sale-form';
export default async function NewSalePage() {
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
