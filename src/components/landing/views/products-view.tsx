'use client';

import {
    Plus,
    Package,
    Barcode,
    Search,
    ArrowUpDown,
    MoreVertical,
    AlertTriangle
} from 'lucide-react';

export function ProductsView() {
    const products = [
        { name: 'iPhone 15 Pro 256GB', sku: 'IP15-P-256', category: 'โทรศัพท์มือถือ', stock: 12, cost: '฿38,000', price: '฿41,900', status: 'ปกติ' },
        { name: 'AirPods Pro Gen 2', sku: 'AP-P2', category: 'อุปกรณ์เสริม', stock: 1, cost: '฿6,500', price: '฿8,990', status: 'ใกล้หมด', color: 'text-red-600' },
        { name: 'Samsung S24 Ultra', sku: 'SS-S24-U', category: 'โทรศัพท์มือถือ', stock: 5, cost: '฿35,000', price: '฿39,900', status: 'ปกติ' },
        { name: 'iPad Air 5 M1', sku: 'IPD-A5', category: 'แท็บเล็ต', stock: 3, cost: '฿18,000', price: '฿21,900', status: 'ปกติ' },
        { name: 'MagSafe Charger', sku: 'MS-CHG', category: 'อุปกรณ์เสริม', stock: 24, cost: '฿950', price: '฿1,490', status: 'ปกติ' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">สินค้า</h1>
                    <p className="text-sm text-muted-foreground">บริหารจัดการสต็อก ราคาทุน และราคาขายรายชิ้น</p>
                </div>
                <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-bold flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    เพิ่มสินค้า
                </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อสินค้า, SKU, บาร์โค้ด..."
                        className="w-full pl-10 h-10 rounded-lg border bg-background text-sm"
                        readOnly
                    />
                </div>
            </div>

            <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                                <th className="px-6 py-4">ข้อมูลสินค้า / SKU</th>
                                <th className="px-6 py-4">หมวดหมู่</th>
                                <th className="px-6 py-4 text-center">คงเหลือ</th>
                                <th className="px-6 py-4 text-right">ราคาทุน</th>
                                <th className="px-6 py-4 text-right">ราคาขาย</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {products.map((p) => (
                                <tr key={p.sku} className="group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                                                <Package className="h-5 w-5 text-muted-foreground/50" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-foreground leading-tight">{p.name}</div>
                                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Barcode className="h-2.5 w-2.5" />
                                                    {p.sku}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-muted-foreground">{p.category}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className={`font-black ${p.color || 'text-foreground'}`}>{p.stock}</div>
                                        {p.status === 'ใกล้หมด' && (
                                            <div className="flex items-center justify-center gap-1 text-red-500 text-[9px] font-bold">
                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                ใกล้หมด
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-muted-foreground">{p.cost}</td>
                                    <td className="px-6 py-4 text-right font-bold">{p.price}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-1 hover:bg-muted rounded text-muted-foreground">
                                            <MoreVertical className="h-4 w-4" />
                                        </button>
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
