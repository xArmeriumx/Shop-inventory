'use client';

import Link from 'next/link';
import { ShoppingCart, Package, Truck, ClipboardList, History, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/formatters';

interface OperationalMetricProps {
  metrics: {
    pendingSales: number;
    pendingProcurement: number;
    pendingShipments: number;
    recentStockMoves: Array<{
      id: string;
      date: Date;
      actor: string;
      note: string;
      productId?: string | null;
    }>;
  };
  lowStockCount: number;
}

export function ActionableSmeDashboard({ metrics, lowStockCount }: OperationalMetricProps) {
  const cards = [
    {
      title: 'งานขายค้าง',
      value: metrics.pendingSales,
      description: 'รอจองสต็อก/ออกใบแจ้งหนี้',
      icon: ShoppingCart,
      color: 'text-blue-600',
      href: '/sales?status=DRAFT,CONFIRMED',
      buttonText: 'ดูรายการขาย',
    },
    {
      title: 'ของใกล้หมด',
      value: lowStockCount,
      description: 'สินค้าที่ต้องสั่งเพิ่ม',
      icon: AlertCircle,
      color: 'text-red-600',
      href: '/products/low-stock',
      buttonText: 'สั่งของเพิ่ม',
      variant: lowStockCount > 0 ? 'destructive_outline' : 'outline',
    },
    {
      title: 'งานซื้อค้าง',
      value: metrics.pendingProcurement,
      description: 'PR/PO ที่รอรับสินค้า',
      icon: ClipboardList,
      color: 'text-purple-600',
      href: '/purchases?status=DRAFT,PENDING,APPROVED,ORDERED',
      buttonText: 'ดูใบสั่งซื้อ',
    },
    {
      title: 'งานส่งของค้าง',
      value: metrics.pendingShipments,
      description: 'รายการรอจัดส่งวันนี้',
      icon: Truck,
      color: 'text-amber-600',
      href: '/shipments?status=PENDING,PROCESSING',
      buttonText: 'ดูงานขนส่ง',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-bold">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                </div>
                <Button variant={(card.variant as any) || "outline"} size="sm" className="h-8 text-xs px-2" asChild>
                  <Link href={card.href}>{card.buttonText}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Stock Moves - SME Simplified */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-bold">ปรับสต็อกมือล่าสุด</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-8" asChild>
              <Link href="/system/audit-logs?action=STOCK_MOVE">ดูทั้งหมด</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-0">
          {metrics.recentStockMoves.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground px-6">
              ไม่มีรายงานการปรับสต็อกในขณะนี้
            </div>
          ) : (
            <div className="divide-y">
              {metrics.recentStockMoves.map((move) => (
                <div key={move.id} className="flex items-center justify-between py-3 px-6 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-none">
                      {move.note}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      โดย {move.actor} · {formatDate(move.date)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href={`/system/audit-logs/${move.id}`}>
                      <History className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
