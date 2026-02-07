'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Truck, CheckCircle2, RotateCcw, XCircle, Send } from 'lucide-react';
import { getShipmentStats } from '@/actions/shipments';
import Link from 'next/link';
import { Guard } from '@/components/auth/guard';

interface ShipmentStatsData {
  PENDING: number;
  SHIPPED: number;
  DELIVERED: number;
  RETURNED: number;
  CANCELLED: number;
}

export function ShipmentStatsWidget() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    getShipmentStats()
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  const total = stats.PENDING + stats.SHIPPED + stats.DELIVERED + stats.RETURNED;
  if (total === 0) return null;

  const items = [
    { label: 'รอจัดส่ง', value: stats.PENDING, icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'ส่งแล้ว', value: stats.SHIPPED, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'ส่งถึงแล้ว', value: stats.DELIVERED, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'ส่งคืน', value: stats.RETURNED, icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'ยกเลิก', value: stats.CANCELLED, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <Guard permission="SHIPMENT_VIEW">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">สถานะจัดส่ง</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shipments">
              <Send className="h-4 w-4 mr-1" />
              ดูทั้งหมด
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {items.map((item) => (
              <div key={item.label} className={`flex flex-col items-center p-3 rounded-lg ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color} mb-1`} />
                <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Guard>
  );
}
