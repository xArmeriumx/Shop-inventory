'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, User, MapPin, Hash } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface VendorSnapshotSectionProps {
  data: any;
}

export function VendorSnapshotSection({ data }: VendorSnapshotSectionProps) {
  return (
    <Card className="rounded-[2rem] border-primary/10 shadow-lg overflow-hidden bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Supplier Persistence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-background border flex items-center justify-center shadow-sm">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">ผู้จำหน่าย (Snapshot)</p>
              <p className="text-sm font-black text-foreground leading-tight tracking-tight">
                {data.vendorNameSnapshot}
              </p>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">เลขที่ผู้เสียภาษี</span>
                <span className="text-xs font-mono font-bold tracking-wider">{data.vendorTaxIdSnapshot || 'ไม่ระบุ'}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">ที่อยู่ตามใบกำกับภาษี</span>
                <span className="text-xs font-medium text-muted-foreground leading-relaxed">
                  {data.vendorAddressSnapshot || 'ไม่ได้ระบุที่อยู่ไว้ในขณะที่เปิดเอกสาร'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-[9px] text-primary font-bold uppercase text-center tracking-[0.2em]">
            Data Integrity Applied
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
