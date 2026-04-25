import { PageHeader } from '@/components/layout/page-header';
import { SaleForm } from '@/components/sales/sale-form';
export default async function NewSalePage() {
  return (
    <div>
      <PageHeader
        title="บันทึกใบสั่งขาย (New Sales Order)"
        description="สร้างใบสั่งขายเพื่อเตรียมจัดส่งสินค้า"
      />

      <div className="max-w-4xl">
        <SaleForm />
      </div>
    </div>
  );
}
