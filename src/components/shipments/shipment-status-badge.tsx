'use client';

import { StatusBadge, type StatusConfig } from '@/components/ui/status-badge';
import type { ShipmentStatus } from '@prisma/client';

// Status config is the single source of truth for shipment status display
const SHIPMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'รอจัดส่ง', variant: 'outline', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  PROCESSING: { label: 'กำลังแพ็ค', variant: 'secondary', className: 'bg-purple-100 text-purple-700' },
  SHIPPED: { label: 'ส่งแล้ว', variant: 'default', className: 'bg-blue-500 hover:bg-blue-600' },
  DELIVERED: { label: 'ส่งถึงแล้ว', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  RETURNED: { label: 'ส่งคืน', variant: 'secondary', className: 'bg-orange-100 text-orange-700' },
  CANCELLED: { label: 'ยกเลิก', variant: 'destructive' },
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <StatusBadge status={status} config={SHIPMENT_STATUS_CONFIG} />;
}
