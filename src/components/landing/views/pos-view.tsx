'use client';

import { useState } from 'react';
import { ScanBarcode, Search, ShoppingCart, Package, Plus, Minus, X, User, Receipt } from 'lucide-react';

const MOCK_PRODUCTS = [
    { id: 1, name: 'iPhone 15 Pro 256GB', price: 41900, stock: 12, category: 'Phone' },
    { id: 2, name: 'AirPods Pro Gen 2', price: 8990, stock: 5, category: 'Audio' },
    { id: 3, name: 'Samsung S24 Ultra', price: 39900, stock: 8, category: 'Phone' },
    { id: 4, name: 'iPad Air 5 M1', price: 21900, stock: 3, category: 'Tablet' },
    { id: 5, name: 'MagSafe Charger', price: 1490, stock: 24, category: 'Accessory' },
    { id: 6, name: 'Apple Watch Series 9', price: 15900, stock: 10, category: 'Watch' },
];

export function POSView() {
    const [cart, setCart] = useState<{ id: number, name: string, price: number, qty: number }[]>([
        { id: 1, name: 'iPhone 15 Pro 256GB', price: 41900, qty: 1 },
        { id: 5, name: 'MagSafe Charger', price: 1490, qty: 2 },
    ]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');

    const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const subtotal = total / 1.07;
    const vat = total - subtotal;

    return (
        <div className="h-full flex flex-col -m-8 relative">
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Cart & Checkout - Hidden on small screens */}
                <div className="hidden lg:flex w-[340px] border-r bg-white flex-col shrink-0">
                    {/* Mock Scanner */}
                    <div className="p-4 border-b">
                        <div className="relative">
                            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="สแกนบาร์โค้ด..."
                                className="w-full pl-9 h-10 rounded-lg border bg-muted/20 text-xs font-medium"
                                readOnly
                            />
                        </div>
                    </div>

                    {/* Customer Selector */}
                    <div className="p-4 border-b flex items-center justify-between text-xs font-bold text-muted-foreground bg-muted/5">
                        <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            ลูกค้าทั่วไป (Walk-in)
                        </div>
                        <button className="text-foreground hover:underline">เปลี่ยน</button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {cart.map((item) => (
                            <div key={item.id} className="flex flex-col gap-2 p-3 rounded-xl border bg-background group">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="font-bold text-[11px] leading-tight">{item.name}</div>
                                    <button className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                                        <button className="h-5 w-5 flex items-center justify-center rounded border bg-background"><Minus className="h-2.5 w-2.5" /></button>
                                        <span className="text-[11px] font-black w-4 text-center">{item.qty}</span>
                                        <button className="h-5 w-5 flex items-center justify-center rounded border bg-background"><Plus className="h-2.5 w-2.5" /></button>
                                    </div>
                                    <div className="text-[11px] font-black">฿{(item.price * item.qty).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary & Checkout */}
                    <div className="p-6 border-t bg-muted/5 space-y-4">
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-muted-foreground">
                                <span>รวม (Subtotal)</span>
                                <span>฿{subtotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                                <span>ภาษี (VAT 7%)</span>
                                <span>฿{vat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between font-black text-lg pt-1 text-foreground">
                                <span>ทั้งหมด</span>
                                <span>฿{total.toLocaleString()}</span>
                            </div>
                        </div>
                        <button className="w-full h-14 bg-foreground text-background rounded-2xl font-black text-lg shadow-xl shadow-foreground/10 flex items-center justify-center gap-2">
                            <Receipt className="h-5 w-5" />
                            ชำระเงิน
                        </button>
                    </div>
                </div>

                {/* Right: Product Selection */}
                <div className="flex-1 flex flex-col bg-[#fbfbfc] min-w-0">
                    {/* Header */}
                    <div className="p-4 bg-white border-b space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="ค้นหาสินค้า..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-10 h-10 rounded-xl border border-border bg-background text-sm"
                                />
                            </div>
                            <div className="sm:hidden flex items-center gap-2 p-2 bg-muted/50 rounded-xl">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-[10px] font-bold">Walk-in</span>
                            </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['All', 'Phone', 'Audio', 'Tablet', 'Watch', 'Accessory'].map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${category === cat ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 overflow-auto p-4 sm:p-6 mb-20 lg:mb-0">
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {MOCK_PRODUCTS.filter(p => (category === 'All' || p.category === category) && p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
                                <div key={p.id} className="bg-white rounded-2xl border p-3 sm:p-4 shadow-sm space-y-2 sm:space-y-3 cursor-pointer">
                                    <div className="aspect-square rounded-xl bg-muted/50 flex items-center justify-center">
                                        <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/30" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] sm:text-[11px] font-bold leading-tight line-clamp-2">{p.name}</div>
                                        <div className="flex items-center justify-between pt-1">
                                            <div className="text-[10px] sm:text-[11px] font-black text-foreground">฿{p.price.toLocaleString()}</div>
                                            <div className={`text-[8px] sm:text-[9px] font-bold ${p.stock < 5 ? 'text-red-500' : 'text-muted-foreground'}`}>Stock: {p.stock}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: Floating Cart Button */}
            <div className="lg:hidden absolute bottom-6 left-6 right-6 z-40">
                <button
                    onClick={() => setIsMobileCartOpen(true)}
                    className="w-full h-14 bg-foreground text-background rounded-2xl font-black text-sm shadow-2xl flex items-center justify-between px-6"
                >
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        ตะกร้า ({cart.length})
                    </div>
                    <div className="text-lg">฿{total.toLocaleString()}</div>
                </button>
            </div>

            {/* Mobile: Cart Sheet */}
            {isMobileCartOpen && (
                <div className="lg:hidden fixed inset-0 z-[110]">
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileCartOpen(false)} />
                    <div className="absolute bottom-0 left-0 right-0 bg-background border-t rounded-t-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300">
                        <div className="p-6 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2 font-black">
                                <ShoppingCart className="h-5 w-5" />
                                ตะกร้าสินค้า
                                <span className="bg-muted px-2 py-0.5 rounded-full text-[10px]">{cart.length}</span>
                            </div>
                            <button onClick={() => setIsMobileCartOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-full bg-muted/50"><X className="h-4 w-4" /></button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 space-y-4">
                            {cart.map((item) => (
                                <div key={item.id} className="flex justify-between items-center gap-4">
                                    <div className="flex-1">
                                        <div className="text-xs font-bold leading-tight">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground font-medium mt-1">฿{item.price.toLocaleString()} / ชิ้น</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                                            <button className="h-6 w-6 flex items-center justify-center rounded border bg-background"><Minus className="h-2.5 w-2.5" /></button>
                                            <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                                            <button className="h-6 w-6 flex items-center justify-center rounded border bg-background"><Plus className="h-2.5 w-2.5" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 border-t bg-muted/5 space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                    <span>ราคารวม</span>
                                    <span>฿{total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-lg font-black pt-2 border-t">
                                    <span>ยอดสุทธิ</span>
                                    <span>฿{total.toLocaleString()}</span>
                                </div>
                            </div>
                            <button className="w-full h-16 bg-foreground text-background rounded-2xl font-black text-xl shadow-xl flex items-center justify-center gap-3">
                                <Receipt className="h-6 w-6" />
                                ชำระเงิน
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
