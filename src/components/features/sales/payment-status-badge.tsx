'use client';

import { Badge } from '@/components/ui/badge';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  PENDING: {
    label: 'รอตรวจสอบ',
    variant: 'outline',
    className: 'border-yellow-500 text-yellow-600 bg-yellow-50',
  },
  VERIFIED: {
    label: 'ยืนยันแล้ว',
    variant: 'default',
    className: 'bg-green-500 hover:bg-green-600',
  },
  REJECTED: {
    label: 'ปฏิเสธ',
    variant: 'destructive',
  },
};

interface PaymentStatusBadgeProps {
  status: string;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
