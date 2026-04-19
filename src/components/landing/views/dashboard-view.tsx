'use client';

import {
    ShoppingCart,
    TrendingUp,
    Box,
    Warehouse,
    MinusCircle,
    Receipt,
    Truck,
    History,
    Activity,
    ChevronRight,
    ShieldCheck,
} from 'lucide-react';

export function DashboardView() {
    return (
        <div className="space-y-8">
            {/* Dashboard Header */}
            <div className="space-y-0.5">
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground">ภาพรวมการดำเนินงาน</p>
            </div>

            {/* Metric Cards Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'วันนี้ยอดขาย', val: '฿0', sub: '0 รายการ', icon: ShoppingCart, color: 'text-blue-600' },
                    { label: 'วันนี้กำไร', val: '฿0', sub: 'จาก 0 รายการ', icon: TrendingUp, color: 'text-green-600' },
                    { label: 'สินค้าทั้งหมด', val: '15', sub: 'รายการที่เปิดขาย', icon: Box, color: 'text-purple-600' },
                    { label: 'มูลค่าสต็อกรวม', val: '฿35,100', sub: '1 ชิ้น ในคลัง', icon: Warehouse, color: 'text-indigo-600' },
                ].map(m => (
                    <div key={m.label} className="p-5 rounded-xl border bg-background flex flex-col justify-between shadow-sm h-32">
                        <div className="flex justify-between items-start">
                            <span className="text-[12px] font-medium text-muted-foreground">{m.label}</span>
                            <m.icon className={`h-4 w-4 ${m.color}`} />
                        </div>
                        <div className="space-y-0.5">
                            <div className="text-2xl font-bold">{m.val}</div>
                            <div className="text-[10px] text-muted-foreground">{m.sub || ''}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Metric Cards Row 2 (Task-oriented) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'งานขายค้าง', val: '0', sub: 'รอวางบิล / ออกใบแจ้งหนี้', icon: ShoppingCart, color: 'text-blue-600', btn: 'ดูรายการขาย' },
                    { label: 'ของใกล้หมด', val: '14', sub: 'สินค้าที่ต้องสั่งเพิ่ม', icon: MinusCircle, color: 'text-red-600', btn: 'สั่งของเพิ่ม' },
                    { label: 'งานซื้อค้าง', val: '0', sub: 'PR/PO ที่รอรับสินค้า', icon: Receipt, color: 'text-purple-600', btn: 'ดูใบสั่งซื้อ' },
                    { label: 'งานส่งของค้าง', val: '0', sub: 'รายการรวมจัดส่งวันนี้', icon: Truck, color: 'text-orange-600', btn: 'ดูงานขนส่ง' },
                ].map(m => (
                    <div key={m.label} className="p-5 rounded-xl border bg-background flex flex-col justify-between shadow-sm h-32">
                        <div className="flex justify-between items-start">
                            <span className="text-[12px] font-medium text-muted-foreground">{m.label}</span>
                            <m.icon className={`h-4 w-4 ${m.color}`} />
                        </div>
                        <div className="flex items-end justify-between">
                            <div className="space-y-0.5">
                                <div className="text-2xl font-bold">{m.val}</div>
                                <div className="text-[10px] text-muted-foreground">{m.sub}</div>
                            </div>
                            <button className="text-[10px] bg-muted px-2 py-1 rounded border font-medium hover:bg-muted/80">
                                {m.btn}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Stock Adjustment Section */}
            <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
                <div className="p-5 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <History className="h-4 w-4 text-muted-foreground" />
                        ปรับสต็อกล่าสุด
                    </div>
                    <button className="text-xs font-medium hover:underline">ดูทั้งหมด</button>
                </div>
                <div className="h-32 flex items-center justify-center text-sm text-muted-foreground bg-muted/5">
                    ไม่มีรายงานการปรับสต็อกในขณะนี้
                </div>
            </div>

            {/* Advanced ERP Operations Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-muted-foreground uppercase tracking-widest">
                        <Activity className="h-4 w-4" />
                        Advanced ERP Operations
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Monthly Summary */}
                    <div className="p-6 rounded-xl border bg-background shadow-sm space-y-6">
                        <h3 className="font-bold text-sm">สรุปรายเดือน</h3>
                        <div className="flex items-center justify-between text-center">
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground font-medium">ยอดขาย</div>
                                <div className="text-xl font-bold">฿0</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground font-medium">กำไร</div>
                                <div className="text-xl font-bold text-emerald-600">฿0</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground font-medium">รายการ</div>
                                <div className="text-xl font-bold">0</div>
                            </div>
                        </div>
                    </div>

                    {/* Daily Expenses */}
                    <div className="p-6 rounded-xl border bg-background shadow-sm flex flex-col justify-between">
                        <h3 className="font-bold text-sm">ค่าใช้จ่ายวันนี้</h3>
                        <div className="space-y-1 mt-4">
                            <div className="text-2xl font-bold text-red-600">฿0</div>
                            <div className="text-[10px] text-muted-foreground">0 รายการ</div>
                        </div>
                    </div>

                    {/* Governance Health */}
                    <div className="p-6 rounded-xl border bg-background shadow-sm space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <ShieldCheck className="h-4 w-4" />
                                Governance Health
                            </div>
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase tracking-tighter">
                                SYSTEM SECURE
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-muted/30 border">
                                <div className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Audit Failures</div>
                                <div className="text-xl font-bold">0</div>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 border">
                                <div className="text-[8px] font-bold text-muted-foreground uppercase mb-1">Access Denials</div>
                                <div className="text-xl font-bold">0</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
