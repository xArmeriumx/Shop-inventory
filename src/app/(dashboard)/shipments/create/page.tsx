import { getSalesWithoutShipment } from '@/actions/shipments';
import { ShipmentForm } from '@/components/features/shipments/shipment-form';

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">สร้างรายการจัดส่ง</h1>
        <p className="text-muted-foreground">
          เลือกรายการขายและกรอกข้อมูลการจัดส่ง
        </p>
      </div>

      <ShipmentForm sales={sales as any} preSelectedSaleId={params.saleId} />
    </div>
  );
}
