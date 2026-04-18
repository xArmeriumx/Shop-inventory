import { PageHeader } from '@/components/layout/page-header';
import { PurchaseForm } from '@/components/purchases/purchase-form';

export default function NewPurchasePage() {
  return (
    <div>
      <PageHeader
        title="บันทึกการซื้อ"
        description="เพิ่มสินค้าเข้าสต็อก"
      />
      <div className="max-w-4xl">
        <PurchaseForm />
      </div>
    </div>
  );
}
