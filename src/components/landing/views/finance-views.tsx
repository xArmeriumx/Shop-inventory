'use client';

import { Receipt, DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, Tag, MoreVertical } from 'lucide-react';

export function PurchasesView() {
    const orders = [
        { id: 'PO-2024001', vendor: 'Apple Thailand', total: '฿1,250,000', status: 'รอรับสินค้า', date: '2 วันที่แล้ว' },
        { id: 'PO-2024002', vendor: 'Com7 Public Co.', total: '฿450,000', status: 'ฉบับร่าง', date: 'เมื่อวาน 14:00' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">การสั่งซื้อ</h1>
                <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-bold flex items-center gap-2">
                    สร้างใบสั่งซื้อ (PO)
                </button>
            </div>

            <div className="rounded-xl border bg-background shadow-sm overflow-hidden text-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                <th className="px-6 py-4">เลขที่ใบสั่งซื้อ</th>
                                <th className="px-6 py-4">ผู้จำหน่าย</th>
                                <th className="px-6 py-4">ยอดรวม</th>
                                <th className="px-6 py-4 text-center">สถานะ</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {orders.map((o) => (
                                <tr key={o.id}>
                                    <td className="px-6 py-4 font-bold">{o.id}</td>
                                    <td className="px-6 py-4 font-medium">{o.vendor}</td>
                                    <td className="px-6 py-4 font-bold">{o.total}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold">{o.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <MoreVertical className="h-4 w-4 text-muted-foreground ml-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function FinanceViews({ type }: { type: 'expenses' | 'incomes' }) {
    const isIncome = type === 'incomes';
    const items = isIncome ? [
        { label: 'ค่าซ่อมอุปกรณ์', amount: '+฿4,500', category: 'บริการ', date: 'วันนี้ 10:00' },
        { label: 'เงินปันผลหุ้น', amount: '+฿12,000', category: 'การลงทุน', date: 'วานนี้' },
    ] : [
        { label: 'ค่าเช่าสำนักงาน', amount: '-฿15,000', category: 'สถานที่', date: '18 เม.ย.' },
        { label: 'ค่าน้ำ-ไฟ', amount: '-฿2,450', category: 'สาธารณูปโภค', date: '17 เม.ย.' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isIncome ? 'รายรับอื่นๆ' : 'ค่าใช้จ่าย'}</h1>
                    <p className="text-sm text-muted-foreground">บันทึกรายการ{isIncome ? 'รับ' : 'จ่าย'}ที่ไม่ใช่การขายสินค้า</p>
                </div>
                <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-bold">
                    บันทึกรายการ
                </button>
            </div>

            <div className="space-y-3">
                {items.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border bg-background flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isIncome ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                            </div>
                            <div>
                                <div className="font-bold text-sm">{item.label}</div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <Tag className="h-2.5 w-2.5" /> {item.category}
                                    <span className="opacity-25">|</span>
                                    {item.date}
                                </div>
                            </div>
                        </div>
                        <div className={`font-black text-sm ${isIncome ? 'text-green-600' : 'text-red-600'}`}>{item.amount}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
