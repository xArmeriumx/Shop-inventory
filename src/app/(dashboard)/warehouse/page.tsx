import { Search, PackageOpen, Download, LayoutGrid, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';

export default function WarehousePortal() {
  const actions = [
    {
      title: 'เช็คสต็อก / ค้นหา',
      description: 'ตรวจสอบจำนวนคงเหลือและพิกัดสินค้า',
      icon: Search,
      href: '/warehouse/lookup',
      color: 'bg-blue-500',
    },
    {
      title: 'ปรับสต็อก / ตรวจนับ',
      description: 'ปรับปรุงจำนวนสินค้าจริงในคลัง',
      icon: LayoutGrid,
      href: '/warehouse/adjust',
      color: 'bg-orange-500',
    },
    {
      title: 'รับสินค้าเข้า PO',
      description: 'ยืนยันการรับของจากการสั่งซื้อ',
      icon: Download,
      href: '/warehouse/receive',
      color: 'bg-green-500',
    },
  ];

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">คลังสินค้า (Mobile)</h1>
      </div>

      <div className="grid gap-4">
        {actions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="hover:bg-muted/50 transition-colors active:scale-95 touch-none">
              <CardContent className="p-6 flex items-center gap-6">
                <div className={`${action.color} p-4 rounded-2xl text-white shadow-lg`}>
                  <action.icon className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground leading-tight">
                    {action.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="bg-muted/30 p-4 rounded-xl border border-dashed text-center">
        <PackageOpen className="h-10 w-10 mx-auto opacity-20 mb-2" />
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
          Warehouse Operation Mode
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Optimized for handheld scanners & mobile devices
        </p>
      </div>
    </div>
  );
}
