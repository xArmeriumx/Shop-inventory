import { Badge } from '@/components/ui/badge';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StatusConfig {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
}

export interface StatusBadgeProps {
    status: string;
    config: Record<string, StatusConfig>;
    fallback?: string;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

/**
 * Generic status badge. Driven entirely by a config map.
 * Replaces the repeated STATUS_CONFIG + Badge pattern in each feature module.
 *
 * @example
 * const PAYMENT_STATUS: Record<string, StatusConfig> = {
 *   PENDING: { label: 'รอตรวจสอบ', variant: 'outline', className: 'border-yellow-500 text-yellow-600' },
 *   VERIFIED: { label: 'ยืนยันแล้ว', variant: 'default', className: 'bg-green-500' },
 * };
 * <StatusBadge status={sale.paymentStatus} config={PAYMENT_STATUS} />
 */
export function StatusBadge({ status, config, fallback = 'PENDING' }: StatusBadgeProps) {
    const entry = config[status] ?? config[fallback] ?? { label: status, variant: 'outline' as const };

    return (
        <Badge variant={entry.variant} className={entry.className}>
            {entry.label}
        </Badge>
    );
}
