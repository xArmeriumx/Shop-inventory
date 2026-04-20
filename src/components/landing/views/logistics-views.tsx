'use client';

import { Truck, RotateCcw, Box, Package, History, Search, CheckCircle2, Clock } from 'lucide-react';
import { TableView, Column } from '@/components/ui/table-view';

interface Shipment {
    id: string;
    order: string;
    carrier: string;
    track: string;
    status: string;
    date: string;
}

export function ShipmentsView() {
    const shipments: Shipment[] = [
        { id: 'SHP-001', order: 'INV-2024001', carrier: 'Kerry Express', track: 'KRY990123', status: 'จัดส่งสำเร็จ', date: 'วันนี้ 14:20' },
        { id: 'SHP-002', order: 'INV-2024002', carrier: 'Flash Express', track: 'FLH440556', status: 'กำลังจัดส่ง', date: 'วันนี้ 11:45' },
        { id: 'SHP-003', order: 'INV-2024004', carrier: 'J&T Express', track: 'JNT770889', status: 'เตรียมจัดส่ง', date: 'วานนี้ 16:30' },
    ];

    const columns: Column<Shipment>[] = [
        {
            header: 'ขนส่ง / Tracking',
            accessor: (s) => (
                <>
                    <div className="font-bold">{s.carrier}</div>
                    <div className="text-[10px] text-muted-foreground">{s.track}</div>
                </>
            )
        },
        { header: 'เลขอ้างอิงบิล', accessor: 'order', className: 'font-medium' },
        {
            header: 'สถานะ',
            align: 'center',
            accessor: (s) => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'จัดส่งสำเร็จ' ? 'bg-green-100 text-green-700' : s.status === 'กำลังจัดส่ง' ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                    {s.status}
                </span>
            )
        },
        { header: 'อัปเดตล่าสุด', accessor: 'date', align: 'right', className: 'text-xs text-muted-foreground' }
    ];

    return (
        <div className="space-y-6">
            <TableView
                title="การจัดส่ง"
                description="ติดตามสถานะพัสดุและเลข Tracking รายบิล"
                items={shipments}
                columns={columns}
                keyExtractor={(s) => s.id}
            />

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
        </div>
    );
}

export function ReturnsView() {
    const returns = [
        { id: 'RET-001', order: 'INV-2024005', product: 'Smart Watch S7', qty: 1, amount: '฿1,200', reason: 'สินค้ามีตำหนิ', date: 'วันนี้ 15:30' },
        { id: 'RET-002', order: 'INV-2023990', product: 'USB-C Hub', qty: 2, amount: '฿1,700', reason: 'เปลี่ยนใจ', date: 'วานนี้ 09:10' },
    ];

    const columns: Column<typeof returns[0]>[] = [
        { header: 'เลขอ้างอิงคืน', accessor: 'id', className: 'font-bold' },
        { header: 'รายการสินค้า', accessor: 'product' },
        { header: 'จำนวน', accessor: 'qty', align: 'center' },
        { header: 'ยอดเงินคืน', accessor: 'amount', align: 'right', className: 'font-bold text-red-600' },
        { header: 'เหตุผล', accessor: 'reason', className: 'text-xs italic text-muted-foreground' },
        { header: 'วันที่', accessor: 'date', align: 'right', className: 'text-xs' }
    ];

    return (
        <div className="space-y-6">
            <TableView
                title="รายการคืนสินค้า"
                description="จัดการการคืนสินค้า คืนสต็อก และคืนเงินลูกค้า"
                items={returns}
                columns={columns}
                keyExtractor={(r) => r.id}
            />
        </div>
    );
}

export function WarehouseView() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">คลังสินค้า</h1>
                    <p className="text-sm text-muted-foreground">ตรวจสอบพื้นที่จัดเก็บและสถานะสต็อกรายคลัง</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { name: 'คลังสินค้าหลัก (Bangkok)', capacity: '85%', items: 1240, color: 'bg-green-500' },
                    { name: 'คลังสินค้าสำรอง (Nonthaburi)', capacity: '30%', items: 450, color: 'bg-blue-500' },
                ].map((w, i) => (
                    <div key={i} className="p-6 rounded-xl border bg-background shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{w.name}</div>
                            <div className={`h-2 w-2 rounded-full ${w.color} animate-pulse`} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium">
                                <span className="text-muted-foreground">ความจุที่ใช้ไป</span>
                                <span>{w.capacity}</span>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div className={`h-full ${w.color}`} style={{ width: w.capacity }} />
                            </div>
                        </div>
                        <div className="pt-2 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">สินค้าทั้งหมด <span className="font-bold text-foreground">{w.items} ชิ้น</span></div>
                            <button className="text-xs font-bold text-primary hover:underline">จัดการคลัง ➔</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-8 rounded-xl border border-dashed bg-muted/20 text-center">
                <Box className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="font-bold text-foreground">ไม่มีข้อมูลการเคลื่อนย้ายล่าสุด</h3>
                <p className="text-xs max-w-xs mx-auto mt-1">ประวัติการย้ายสินค้าระหว่างคลังจะแสดงผลที่นี่เมื่อมีการทำรายการ</p>
            </div>
        </div>
    );
}
