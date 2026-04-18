import { getSalesWithoutShipment } from '@/actions/shipments';
import { ShipmentScanner } from '@/components/shipments/shipment-scanner';

export const metadata = {
  title: 'สแกนใบเสร็จขนส่ง | Shop Inventory',
};

export default async function ScanShipmentPage() {
  const sales = await getSalesWithoutShipment();

  const availableSales = sales.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerName: s.customer?.name || s.customerName || null,
    totalAmount: s.totalAmount,
  }));

  return <ShipmentScanner availableSales={availableSales} />;
}
