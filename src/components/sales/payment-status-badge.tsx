'use client';

import { StatusBadge, type StatusConfig } from '@/components/ui/status-badge';

// Status config is the single source of truth for payment status display
const PAYMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: { label: 'รอตรวจสอบ', variant: 'outline', className: 'border-yellow-500 text-yellow-600 bg-yellow-50' },
  VERIFIED: { label: 'ยืนยันแล้ว', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
  REJECTED: { label: 'ปฏิเสธ', variant: 'destructive' },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} config={PAYMENT_STATUS_CONFIG} />;
}
