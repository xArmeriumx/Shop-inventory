'use client';

import {
    Plus,
    Package,
    Barcode,
    Search,
    AlertTriangle
} from 'lucide-react';
import { TableView, Column } from '@/components/ui/table-view';

interface Product {
    name: string;
    sku: string;
    category: string;
    stock: number;
    cost: string;
    price: string;
    status: string;
    color?: string;
}

export function ProductsView() {
    const products: Product[] = [
        { name: 'iPhone 15 Pro 256GB', sku: 'IP15-P-256', category: 'โทรศัพท์มือถือ', stock: 12, cost: '฿38,000', price: '฿41,900', status: 'ปกติ' },
        { name: 'AirPods Pro Gen 2', sku: 'AP-P2', category: 'อุปกรณ์เสริม', stock: 1, cost: '฿6,500', price: '฿8,990', status: 'ใกล้หมด', color: 'text-red-600' },
        { name: 'Samsung S24 Ultra', sku: 'SS-S24-U', category: 'โทรศัพท์มือถือ', stock: 5, cost: '฿35,000', price: '฿39,900', status: 'ปกติ' },
        { name: 'iPad Air 5 M1', sku: 'IPD-A5', category: 'แท็บเล็ต', stock: 3, cost: '฿18,000', price: '฿21,900', status: 'ปกติ' },
        { name: 'MagSafe Charger', sku: 'MS-CHG', category: 'อุปกรณ์เสริม', stock: 24, cost: '฿950', price: '฿1,490', status: 'ปกติ' },
    ];

    const columns: Column<Product>[] = [
        {
            header: 'ข้อมูลสินค้า / SKU',
            accessor: (p) => (
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
            )
        },
        {
            header: 'หมวดหมู่',
            accessor: 'category',
            className: 'hidden sm:table-cell',
        },
        {
            header: 'คงเหลือ',
            align: 'center',
            accessor: (p) => (
                <>
                    <div className={`font-black ${p.color || 'text-foreground'}`}>{p.stock}</div>
                    {p.status === 'ใกล้หมด' && (
                        <div className="flex items-center justify-center gap-1 text-red-500 text-[9px] font-bold">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            ใกล้หมด
                        </div>
                    )}
                </>
            )
        },
        { header: 'ราคาทุน', accessor: 'cost', align: 'right', className: 'font-medium text-muted-foreground' },
        { header: 'ราคาขาย', accessor: 'price', align: 'right', className: 'font-bold' },
    ];

    // Correction for the hidden sm:table-cell column to use the correct accessor logic
    columns[1].accessor = (p: Product) => <span className="text-xs text-muted-foreground">{p.category}</span>;

    return (
        <div className="space-y-6">
            <TableView
                title="สินค้า"
                description="บริหารจัดการสต็อก ราคาทุน และราคาขายรายชิ้น"
                items={products}
                columns={columns}
                keyExtractor={(p) => p.sku}
                actionButton={
                    <button className="h-10 px-4 rounded-lg bg-foreground text-background text-sm font-bold flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        เพิ่มสินค้า
                    </button>
                }
            />

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
        </div>
    );
}

