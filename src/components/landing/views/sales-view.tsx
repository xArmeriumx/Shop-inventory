'use client';

import {
    Search,
    Filter,
    Download,
    Plus,
    Clock,
} from 'lucide-react';
import { TableView, Column } from '@/components/ui/table-view';

interface Sale {
    id: string;
    customer: string;
    date: string;
    channel: string;
    total: string;
    status: string;
    color: string;
}

export function SalesView() {
    const sales: Sale[] = [
        { id: 'INV-2024001', customer: 'คุณสมศักดิ์ รวยดี', date: 'วันนี้ 10:20', channel: 'หน้าร้าน', total: '฿12,400', status: 'สำเร็จ', color: 'bg-green-100 text-green-700' },
        { id: 'INV-2024002', customer: 'Walk-in Customer', date: 'วันนี้ 09:45', channel: 'Shopee', total: '฿850', status: 'สำเร็จ', color: 'bg-green-100 text-green-700' },
        { id: 'INV-2024003', customer: 'คุณวราภรณ์ แจ่มใส', date: 'วานนี้ 18:30', channel: 'TikTok Shop', total: '฿2,190', status: 'รอชำระ', color: 'bg-amber-100 text-amber-700' },
        { id: 'INV-2024004', customer: 'คุณกรรชัย หนุ่มกะลา', date: 'วานนี้ 15:10', channel: 'LINE OA', total: '฿4,500', status: 'สำเร็จ', color: 'bg-green-100 text-green-700' },
        { id: 'INV-2024005', customer: 'Walk-in Customer', date: '18 เม.ย. 14:05', channel: 'หน้าร้าน', total: '฿1,200', status: 'ยกเลิก', color: 'bg-red-100 text-red-700' },
    ];

    const columns: Column<Sale>[] = [
        { header: 'เลขอ้างอิง', accessor: 'id', className: 'font-bold' },
        {
            header: 'ลูกค้า / วันที่',
            accessor: (r) => (
                <>
                    <div className="font-medium text-foreground">{r.customer}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {r.date}
                    </div>
                </>
            )
        },
        {
            header: 'ช่องทาง',
            accessor: (r) => <span className="px-2 py-0.5 rounded-full bg-muted border text-[10px] font-medium">{r.channel}</span>
        },
        { header: 'ยอดรวม', accessor: 'total', align: 'right', className: 'font-bold' },
        {
            header: 'สถานะ',
            align: 'center',
            accessor: (r) => (
                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${r.color}`}>
                    {r.status}
                </span>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <TableView
                title="รายการขาย"
                description="จัดการบิลขายและประวัติการทำรายการทั้งหมด"
                items={sales}
                columns={columns}
                keyExtractor={(r) => r.id}
                actionButton={
                    <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-bold flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        สร้างบิลใหม่
                    </button>
                }
            />

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="ค้นหาเลขบิล, ชื่อลูกค้า..."
                        className="w-full pl-10 h-10 rounded-lg border bg-background text-sm"
                        readOnly
                    />
                </div>
                <div className="flex gap-2">
                    <button className="h-10 px-3 rounded-lg border bg-background text-sm flex items-center gap-2 hover:bg-muted">
                        <Filter className="h-4 w-4" />
                        ตัวกรอง
                    </button>
                    <button className="h-10 px-3 rounded-lg border bg-background text-sm flex items-center gap-2 hover:bg-muted">
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="p-4 rounded-xl border bg-muted/5 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <div>แสดง 5 จาก 1,248 รายการ</div>
                <div className="flex gap-1">
                    <button className="h-8 w-8 rounded border flex items-center justify-center hover:bg-background">1</button>
                    <button className="h-8 w-8 rounded border flex items-center justify-center hover:bg-background">2</button>
                    <button className="h-8 w-8 rounded border flex items-center justify-center hover:bg-background">3</button>
                </div>
            </div>
        </div>
    );
}

