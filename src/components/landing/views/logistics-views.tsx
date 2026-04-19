'use client';

import { Truck, RotateCcw, Box, Package, History, Search, MoreVertical, CheckCircle2, Clock } from 'lucide-react';

export function ShipmentsView() {
    const shipments = [
        { id: 'SHP-001', order: 'INV-2024001', carrier: 'Kerry Express', track: 'KRY990123', status: 'จัดส่งสำเร็จ', date: 'วันนี้ 14:20' },
        { id: 'SHP-002', order: 'INV-2024002', carrier: 'Flash Express', track: 'FLH440556', status: 'กำลังจัดส่ง', date: 'วันนี้ 11:45' },
        { id: 'SHP-003', order: 'INV-2024004', carrier: 'J&T Express', track: 'JNT770889', status: 'เตรียมจัดส่ง', date: 'วานนี้ 16:30' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">การจัดส่ง</h1>
                    <p className="text-sm text-muted-foreground">ติดตามสถานะพัสดุและเลข Tracking รายบิล</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'รอดำเนินการ', value: 3, icon: Clock, color: 'text-amber-500' },
                    { label: 'อยู่ระหว่างส่ง', value: 8, icon: Truck, color: 'text-blue-500' },
                    { label: 'ส่งสำเร็จวันนี้', value: 12, icon: CheckCircle2, color: 'text-green-500' },
                ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-xl border bg-background shadow-sm flex items-center gap-4">
                        <div className={`p-3 rounded-lg bg-muted/50 ${stat.color}`}>
                            <stat.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[700px]">
                        <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                <th className="px-6 py-4">ขนส่ง / Tracking</th>
                                <th className="px-6 py-4">เลขอ้างอิงบิล</th>
                                <th className="px-6 py-4 text-center">สถานะ</th>
                                <th className="px-6 py-4 text-right">อัปเดตล่าสุด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {shipments.map((s) => (
                                <tr key={s.id} className="group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold">{s.carrier}</div>
                                        <div className="text-[10px] text-muted-foreground">{s.track}</div>
                                    </td>
                                    <td className="px-6 py-4 font-medium">{s.order}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'จัดส่งสำเร็จ' ? 'bg-green-100 text-green-700' : s.status === 'กำลังจัดส่ง' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs text-muted-foreground">{s.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function ReturnsView() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">การคืนสินค้า</h1>
            <div className="h-64 rounded-xl border border-dashed flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <RotateCcw className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="font-bold text-foreground">ไม่มีรายการคืนสินค้าในขณะนี้</h3>
                    <p className="text-xs max-w-xs mx-auto mt-1">รายการคืนจะปรากฏขึ้นเมื่อลูกค้าขอคืนสินค้าจากประวัติการขาย</p>
                </div>
            </div>
        </div>
    );
}

export function WarehouseView() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">คลังสินค้า (Mobile)</h1>
                    <p className="text-sm text-muted-foreground text-pretty">ออกแบบสำหรับการสแกนด้วยโทรศัพท์มือถือที่หน้าคลัง</p>
                </div>
            </div>

            <div className="max-w-xs mx-auto bg-background border-[8px] border-muted rounded-[3rem] h-[550px] shadow-2xl relative overflow-hidden flex flex-col">
                <div className="h-6 w-32 bg-muted mx-auto rounded-b-2xl mb-4" />
                <div className="flex-1 p-6 space-y-6">
                    <div className="bg-muted/30 p-4 rounded-2xl flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center text-background">
                            <Search className="h-5 w-5" />
                        </div>
                        <div className="font-bold text-sm">สแกนสินค้า...</div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase px-2">งานที่ต้องทำ</div>
                        {[
                            { title: 'รับของเข้า (PO-2024001)', icon: Package, count: '12 รายการ' },
                            { title: 'ตรวจนับสต็อกประจำสัปดาห์', icon: History, count: '45 รายการ' },
                        ].map((task, i) => (
                            <div key={i} className="p-4 rounded-2xl border bg-background shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><task.icon className="h-4 w-4" /></div>
                                    <div className="font-bold text-[11px] leading-tight">{task.title}</div>
                                </div>
                                <div className="text-[9px] font-bold text-muted-foreground">{task.count}</div>
                            </div>
                        ))}
                    </div>

                    <div className="absolute bottom-10 left-6 right-6 h-12 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-sm shadow-xl">
                        เปิดกล้องสแกนบาร์โค้ด
                    </div>
                </div>
            </div>
        </div>
    );
}
