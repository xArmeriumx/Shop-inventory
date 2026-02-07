'use client';

import { Badge } from '@/components/ui/badge';
import type { ShipmentStatus } from '@prisma/client';

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  PENDING: {
    label: 'รอจัดส่ง',
    variant: 'outline',
    className: 'border-yellow-500 text-yellow-600 bg-yellow-50',
  },
  SHIPPED: {
    label: 'ส่งแล้ว',
    variant: 'default',
    className: 'bg-blue-500 hover:bg-blue-600',
  },
  DELIVERED: {
    label: 'ส่งถึงแล้ว',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-600',
  },
  RETURNED: {
    label: 'ส่งคืน',
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-700',
  },
  CANCELLED: {
    label: 'ยกเลิก',
    variant: 'destructive',
  },
};

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
}

export function ShipmentStatusBadge({ status }: ShipmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
