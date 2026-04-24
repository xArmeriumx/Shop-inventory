import { notFound } from 'next/navigation';
import { getShipment } from '@/actions/sales/shipments.actions';
import { ShipmentDetail } from '@/components/sales/shipments/shipment-detail';

interface ShipmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShipmentDetailPageProps) {
  const { id } = await params;
  const result = await getShipment(id);

  if (!result.success) {
    return { title: 'ไม่พบข้อมูลจัดส่ง' };
  }

  return {
    title: `${result.data.shipmentNumber} | จัดส่งสินค้า`,
  };
}

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { id } = await params;
  const result = await getShipment(id);

  if (!result.success) {
    notFound();
  }

  return <ShipmentDetail shipment={result.data} />;
}
