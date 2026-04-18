'use client';

import { useState, useEffect } from 'react';
import { getLogisticsGaps } from '@/actions/ops';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, User, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function LogisticsGapTool() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const gaps = await getLogisticsGaps();
      setData(gaps);
    } catch (error) {
      console.error('Failed to load logistics gaps', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">แก้ไขจุดบอดเส้นทางสัญจร (Logistics Data Gaps)</h3>
          <p className="text-sm text-muted-foreground">รายชื่อลูกค้าที่มีการจัดส่งแต่ระบบยังไม่มีพิกัด (Lat/Lng) เพื่อใช้คำนวณเส้นทาง</p>
        </div>
        <Badge variant={data.length > 0 ? "destructive" : "secondary"}>
          พิกัดไม่ครบ {data.length} รายการ
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.length === 0 ? (
          <Card className="md:col-span-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground">เยี่ยมมาก! ข้อมูลพิกัดลูกค้าครบถ้วนทั้งหมด</p>
            </CardContent>
          </Card>
        ) : (
          data.map((customer) => (
            <Card key={customer.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    {customer.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/customers/${customer.id}/edit`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {customer.phone || 'ไม่ระบุเบอร์โทร'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="bg-muted/50 p-2 rounded text-xs text-muted-foreground line-clamp-2 min-h-[40px]">
                  {customer.address}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-orange-600">
                    มี {customer._count.shipments} การจัดส่งที่ได้รับผลกระทบ
                  </span>
                  <Button size="sm" asChild>
                    <Link href={`/customers/${customer.id}/edit`}>
                      แก้ไขพิกัด
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
