import { getSalesWithoutShipment } from '@/actions/sales/shipments.actions';
import { ShipmentScanner } from '@/components/sales/shipments/shipment-scanner';

export const metadata = {
  title: 'สแกนใบเสร็จขนส่ง | Shop Inventory',
};

export default async function ScanShipmentPage() {
  const result = await getSalesWithoutShipment();

  const availableSales = result.success ? result.data.map((s: any) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerName: s.customer?.name || s.customerName || null,
    totalAmount: s.totalAmount,
  })) : [];

  return <ShipmentScanner availableSales={availableSales} />;
}
