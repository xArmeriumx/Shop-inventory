'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogisticsGapTool } from '@/components/core/system/ops/logistics-gap-tool';
import { ProcurementGapTool } from '@/components/core/system/ops/procurement-gap-tool';
import { StaleDocumentsTool } from '@/components/core/system/ops/stale-documents-tool';
import { 
    ShieldAlert, 
    Truck, 
    ShoppingCart, 
    Clock, 
    Zap, 
    Compass, 
    Layers, 
    ArrowRightLeft,
    SearchCode,
    Cpu
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * OpsHubTemplate — Modernized Screen composer for Ops Management Hub (Phase 3).
 * Diagnostic center for business operation gaps.
 */
export function OpsHubTemplate() {
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') || 'logistics';

    return (
        <div className="space-y-10 pb-12">
            {/* High-Impact Header */}
            <div className="relative group overflow-hidden rounded-[3rem] border-2 border-primary/20 bg-primary/5 p-10 shadow-2xl shadow-primary/5">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="h-24 w-24 rounded-[2rem] bg-foreground text-background flex items-center justify-center shadow-2xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                        <ShieldAlert className="h-12 w-12" />
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-3">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                             <span className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-full">System Ops</span>
                             <span className="px-3 py-1 bg-foreground/10 text-foreground text-[10px] font-black uppercase tracking-widest rounded-full">Diagnostic Center</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
                            Ops Management Hub
                        </h1>
                        <p className="max-w-2xl text-lg font-medium text-muted-foreground leading-relaxed">
                            ศูนย์บัญชาการจัดการความคลาดเคลื่อนทางธุรกิจ ตรวจวินิจฉัยข้อมูลที่สูญหาย 
                            และกู้คืนกระบวนการทำงานที่ติดขัดในระดับบริษัท (Governance Level)
                        </p>
                    </div>
                </div>
            </div>

            {/* Specialized Diagnostic Categories */}
            <Tabs defaultValue={defaultTab} className="space-y-8">
                <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between overflow-x-auto pb-2">
                    <TabsList className="h-auto p-2 bg-muted/40 backdrop-blur-md rounded-[2rem] border-2 border-border gap-2">
                        <TabsTrigger 
                            value="logistics" 
                            className="rounded-[1.5rem] px-8 py-4 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-lg font-black transition-all gap-3"
                        >
                            <Truck className="h-5 w-5" />
                            Logistics Gaps
                        </TabsTrigger>
                        <TabsTrigger 
                            value="procurement" 
                            className="rounded-[1.5rem] px-8 py-4 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-lg font-black transition-all gap-3"
                        >
                            <ShoppingCart className="h-5 w-5" />
                            Procurement Gaps
                        </TabsTrigger>
                        <TabsTrigger 
                            value="stale" 
                            className="rounded-[1.5rem] px-8 py-4 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-lg font-black transition-all gap-3"
                        >
                            <Clock className="h-5 w-5" />
                            Stale Records
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-4 px-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Diagnostic Engine</span>
                            <span className="text-sm font-bold flex items-center gap-2">
                                <Cpu className="h-3 w-3 text-primary" />
                                v3.2.1 Active
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content Panes with High-Impact Backgrounds */}
                <Card className="rounded-[3rem] border-2 shadow-2xl overflow-hidden bg-background/50 backdrop-blur-xl">
                    <CardContent className="p-1 sm:p-4 lg:p-8">
                        <TabsContent value="logistics" className="mt-0 space-y-8 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex items-center gap-4 mb-4 px-4">
                                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                                    <Compass className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black">การวิเคราะห์พิกัดขนส่งที่ขาดหาย</h3>
                                    <p className="text-sm text-muted-foreground font-medium italic">ตรวจสอบใบส่งสินค้าที่ยังไม่ได้ระบุพิกัด ซึ่งจะส่งผลต่อการคำนวณ Route Intelligence</p>
                                </div>
                            </div>
                            <LogisticsGapTool />
                        </TabsContent>
                        
                        <TabsContent value="procurement" className="mt-0 space-y-8 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-500">
                             <div className="flex items-center gap-4 mb-4 px-4">
                                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                                    <SearchCode className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black">การตรวจสอบใบขอซื้อ (PR) ที่ติดขัด</h3>
                                    <p className="text-sm text-muted-foreground font-medium italic">ระบุใบขอซื้อที่ยังไม่มีผู้จัดจำหน่าย หรือราคาฐานข้อมูลไม่เป็นปัจจุบัน</p>
                                </div>
                            </div>
                            <ProcurementGapTool />
                        </TabsContent>
                        
                        <TabsContent value="stale" className="mt-0 space-y-8 border-none p-0 outline-none animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex items-center gap-4 mb-4 px-4">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black">คลังเอกสารตกค้าง (Stale Documents)</h3>
                                    <p className="text-sm text-muted-foreground font-medium italic">กวาดล้างเอกสารที่ไม่มีความเคลื่อนไหวเกิน 3 วันเพื่อลดภาระงานจัดการ</p>
                                </div>
                            </div>
                            <StaleDocumentsTool />
                        </TabsContent>
                    </CardContent>
                </Card>
            </Tabs>

            {/* Ops Footnote */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 px-8 py-10 bg-muted/20 rounded-[2.5rem] border-2 border-dashed">
                <div className="flex flex-col items-center md:items-start gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-widest text-emerald-600">Operations Ready</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground text-center md:text-left max-w-lg">
                        เครื่องมือเหล่านี้ถูกออกแบบมาเพื่อการรักษาความสมบูรณ์ของข้อมูล (Data Integrity) 
                        เจ้าหน้าที่ฝ่ายปฏิบัติการควรตรวจสอบหน้านี้ทุกๆ วันก่อนปิดยอด
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-2xl border-2 h-12 font-bold px-6">
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        Transfer Logs
                    </Button>
                    <Button variant="default" className="rounded-2xl h-12 font-black px-8 bg-foreground text-background hover:bg-foreground/90 transition-transform active:scale-95 shadow-xl">
                        <Zap className="mr-2 h-4 w-4 fill-current" />
                        Run All Checks
                    </Button>
                </div>
            </div>
        </div>
    );
}
