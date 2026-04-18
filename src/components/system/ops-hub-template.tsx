'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogisticsGapTool } from '@/components/system/ops/logistics-gap-tool';
import { ProcurementGapTool } from '@/components/system/ops/procurement-gap-tool';
import { StaleDocumentsTool } from '@/components/system/ops/stale-documents-tool';
import { ShieldAlert, Truck, ShoppingCart, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

/**
 * OpsHubTemplate — Screen composer for Ops Management Hub.
 * Extracted from system/ops/page.tsx. Receives no props (all state via URL).
 */
export function OpsHubTemplate() {
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'logistics';

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <ShieldAlert className="h-8 w-8 text-blue-600" />
                    ระบบจัดการงานค้าง (Ops Management Hub)
                </h1>
                <p className="text-muted-foreground">
                    เครื่องมือสำหรับผู้บริหารจัดการข้อมูลที่ขาดหายและกู้คืนกระบวนการทำงานที่ติดขัด
                </p>
            </div>

            <Tabs defaultValue={defaultTab} className="space-y-4">
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="logistics" className="gap-2">
                        <Truck className="h-4 w-4" />
                        พิกัดขนส่งไม่ครบ
                    </TabsTrigger>
                    <TabsTrigger value="procurement" className="gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        ใบขอซื้อขาดผู้ขาย
                    </TabsTrigger>
                    <TabsTrigger value="stale" className="gap-2">
                        <Clock className="h-4 w-4" />
                        เอกสารค้าง (3+ วัน)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="logistics" className="space-y-4 border-none p-0 outline-none">
                    <LogisticsGapTool />
                </TabsContent>
                <TabsContent value="procurement" className="space-y-4 border-none p-0 outline-none">
                    <ProcurementGapTool />
                </TabsContent>
                <TabsContent value="stale" className="space-y-4 border-none p-0 outline-none">
                    <StaleDocumentsTool />
                </TabsContent>
            </Tabs>
        </div>
    );
}
