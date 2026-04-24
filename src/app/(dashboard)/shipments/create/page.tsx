import { getSalesWithoutShipment } from '@/actions/sales/shipments.actions';
import { ShipmentForm } from '@/components/sales/shipments/shipment-form';
import { BackPageHeader } from '@/components/ui/back-page-header';

export const metadata = {
  title: 'สร้างรายการจัดส่ง | Shop Inventory',
};

interface CreateShipmentPageProps {
  searchParams: Promise<{ saleId?: string }>;
}

export default async function CreateShipmentPage({ searchParams }: CreateShipmentPageProps) {
  const params = await searchParams;
  const sales = await getSalesWithoutShipment();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <BackPageHeader
        backHref="/shipments"
        title="สร้างรายการจัดส่ง"
        description="เลือกรายการขายและกรอกข้อมูลการจัดส่ง"
      />
      <ShipmentForm sales={sales as any} preSelectedSaleId={params.saleId} />
    </div>
  );
}
