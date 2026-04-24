'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ShieldAlert, FileWarning, MapPin, GitBranch, Settings2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface AdvancedMetricProps {
  metrics: {
    prToOrder: number;
    incompleteShipments: number;
    stuckDocs: number;
    governanceIncidents: number;
  };
  isAdmin: boolean;
}

export function AdvancedOpsDashboard({ metrics, isAdmin }: AdvancedMetricProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isAdmin) return null;

  const items = [
    {
      label: 'PR รอออก PO',
      value: metrics.prToOrder,
      icon: GitBranch,
      color: 'text-indigo-600',
      description: 'ใบขอซื้อที่ยังไม่มีผู้ขาย',
      href: '/system/ops?tab=procurement',
    },
    {
      label: 'พิกัดจัดส่งไม่ครบ',
      value: metrics.incompleteShipments,
      icon: MapPin,
      color: 'text-cyan-600',
      description: 'คำนวณเส้นทางไม่ได้',
      href: '/system/ops?tab=logistics',
    },
    {
      label: 'เอกสารตกค้าง',
      value: metrics.stuckDocs,
      icon: FileWarning,
      color: 'text-orange-600',
      description: 'ค้างเกิน 3 วัน',
      href: '/system/ops?tab=stale',
    },
    {
      label: 'เหตุการณ์ผิดปกติ',
      value: metrics.governanceIncidents,
      icon: ShieldAlert,
      color: 'text-red-700',
      description: 'ความพยายามที่ถูกปฏิเสธ',
      href: '/system/audit-logs?status=DENIED',
    },
  ];

  return (
    <div className="mt-8 border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground">Advanced ERP Operations</h3>
          {metrics.stuckDocs + metrics.governanceIncidents > 0 && (
            <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-[10px]">
              {metrics.stuckDocs + metrics.governanceIncidents} alerts
            </Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {isOpen ? (
            <span className="flex items-center gap-1">ซ่อน <ChevronUp className="h-3 w-3" /></span>
          ) : (
            <span className="flex items-center gap-1">ดูระบบขั้นสูง <ChevronDown className="h-3 w-3" /></span>
          )}
        </Button>
      </div>

      {isOpen && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {items.map((item, i) => (
            <Card key={i} className="bg-muted/30 border-dashed border-2">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">{item.value}</span>
                      <span className="text-[10px] text-muted-foreground">รายการ</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                    <Link 
                      href={item.href} 
                      className="text-[10px] text-indigo-600 hover:underline block mt-2"
                    >
                      จัดการทันที →
                    </Link>
                  </div>
                  <item.icon className={`h-5 w-5 ${item.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
