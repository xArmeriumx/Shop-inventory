'use client';

import { Users, Briefcase, Phone, Mail, MapPin, MoreVertical, Star, TrendingUp } from 'lucide-react';

export function PeopleView({ type }: { type: 'suppliers' | 'customers' }) {
    const isSuppliers = type === 'suppliers';
    const items = isSuppliers ? [
        { name: 'Apple Digital (Thailand)', contact: 'คุณสมโภชน์', phone: '02-123-4567', email: 'sales@apple.co.th', volume: '฿4.2M' },
        { name: 'Com7 Public Co., Ltd.', contact: 'คุณวิกฤต', phone: '081-445-6677', email: 'vikhrit@com7.com', volume: '฿1.8M' },
    ] : [
        { name: 'คุณภัทรินทร์ สมใจ', contact: 'ลูกค้า VIP', phone: '095-123-4455', email: 'pattarin@gmail.com', volume: '฿154,000' },
        { name: 'บริษัท ดีไซน์ จำกัด', contact: 'บริษัท', phone: '02-998-1122', email: 'admin@design.co.th', volume: '฿89,200' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isSuppliers ? 'ผู้จำหน่าย' : 'ลูกค้า'}</h1>
                    <p className="text-sm text-muted-foreground">จัดการข้อมูลผู้ติดต่อและ{isSuppliers ? 'ยอดสั่งซื้อสะสม' : 'ประวัติการซื้อ'}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((person, i) => (
                    <div key={i} className="p-5 rounded-2xl border bg-background shadow-sm space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                    {isSuppliers ? <Briefcase className="h-6 w-6 text-muted-foreground" /> : <Users className="h-6 w-6 text-muted-foreground" />}
                                </div>
                                <div>
                                    <div className="font-bold text-lg leading-tight">{person.name}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        {isSuppliers ? <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> : null}
                                        {person.contact}
                                    </div>
                                </div>
                            </div>
                            <button className="p-1 hover:bg-muted rounded text-muted-foreground"><MoreVertical className="h-4 w-4" /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                    <Phone className="h-3 w-3" /> ติดต่อ
                                </div>
                                <div className="text-xs font-medium">{person.phone}</div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                    <TrendingUp className="h-3 w-3" /> ยอดสะสม
                                </div>
                                <div className="text-xs font-bold text-foreground">{person.volume}</div>
                            </div>
                        </div>

                        <div className="pt-2 border-t flex items-center gap-4 text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1"><Mail className="h-3 w-3" /> {person.email}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
