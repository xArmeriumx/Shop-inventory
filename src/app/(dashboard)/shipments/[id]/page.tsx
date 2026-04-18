import { notFound } from 'next/navigation';
import { getShipment } from '@/actions/shipments';
import { ShipmentDetail } from '@/components/shipments/shipment-detail';

interface ShipmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ShipmentDetailPageProps) {
  const { id } = await params;
  try {
    const shipment = await getShipment(id);
    return {
      title: `${shipment.shipmentNumber} | จัดส่งสินค้า`,
    };
  } catch {
    return { title: 'ไม่พบข้อมูลจัดส่ง' };
  }
}

export default async function ShipmentDetailPage({ params }: ShipmentDetailPageProps) {
  const { id } = await params;

  let shipment;
  try {
    shipment = await getShipment(id);
  } catch {
    notFound();
  }

  return <ShipmentDetail shipment={shipment} />;
}
