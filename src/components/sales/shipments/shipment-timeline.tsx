'use client';

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Package, Truck, CheckCircle2, RotateCcw, XCircle, Clock } from 'lucide-react';
import type { ShipmentStatus } from '@prisma/client';

interface TimelineEvent {
  label: string;
  date: Date | string | null;
  icon: React.ReactNode;
  status: 'completed' | 'current' | 'upcoming' | 'cancelled';
}

interface ShipmentTimelineProps {
  shipment: {
    status: ShipmentStatus;
    createdAt: Date | string;
    shippedAt: Date | string | null;
    deliveredAt: Date | string | null;
    trackingNumber?: string | null;
  };
}

export function ShipmentTimeline({ shipment }: ShipmentTimelineProps) {
  const events: TimelineEvent[] = [];

  // Always show: Created
  events.push({
    label: 'สร้างรายการจัดส่ง',
    date: shipment.createdAt,
    icon: <Package className="h-4 w-4" />,
    status: 'completed',
  });

  // Shipped
  if (shipment.status === 'CANCELLED') {
    events.push({
      label: 'ยกเลิก',
      date: null,
      icon: <XCircle className="h-4 w-4" />,
      status: 'cancelled',
    });
  } else {
    const isShipped = ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(shipment.status);
    events.push({
      label: shipment.trackingNumber
        ? `ส่งพัสดุ (${shipment.trackingNumber})`
        : 'ส่งพัสดุ',
      date: shipment.shippedAt,
      icon: <Truck className="h-4 w-4" />,
      status: isShipped ? 'completed' : shipment.status === 'PENDING' ? 'current' : 'upcoming',
    });

    if (shipment.status === 'RETURNED') {
      events.push({
        label: 'ส่งคืน',
        date: null,
        icon: <RotateCcw className="h-4 w-4" />,
        status: 'completed',
      });
    }

    // Delivered
    const isDelivered = shipment.status === 'DELIVERED';
    events.push({
      label: 'ส่งถึงผู้รับ',
      date: shipment.deliveredAt,
      icon: <CheckCircle2 className="h-4 w-4" />,
      status: isDelivered ? 'completed' : 'upcoming',
    });
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <div key={index} className="flex gap-3">
          {/* Vertical line + icon */}
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                event.status === 'completed'
                  ? 'border-green-500 bg-green-50 text-green-600'
                  : event.status === 'cancelled'
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : event.status === 'current'
                  ? 'border-blue-500 bg-blue-50 text-blue-600 animate-pulse'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              {event.status === 'upcoming' ? (
                <Clock className="h-4 w-4" />
              ) : (
                event.icon
              )}
            </div>
            {index < events.length - 1 && (
              <div
                className={`w-0.5 flex-1 min-h-[24px] ${
                  event.status === 'completed' ? 'bg-green-300'
                    : event.status === 'cancelled' ? 'bg-red-300'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>

          {/* Content */}
          <div className="pb-4 pt-1">
            <p
              className={`text-sm font-medium ${
                event.status === 'completed'
                  ? 'text-foreground'
                  : event.status === 'cancelled'
                  ? 'text-red-600'
                  : event.status === 'current'
                  ? 'text-blue-600'
                  : 'text-muted-foreground'
              }`}
            >
              {event.label}
            </p>
            {event.date && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.date), 'd MMM yyyy HH:mm', { locale: th })}
              </p>
            )}
            {!event.date && event.status === 'upcoming' && (
              <p className="text-xs text-muted-foreground">รอดำเนินการ</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
