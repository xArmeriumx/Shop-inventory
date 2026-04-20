'use client';

import Link from 'next/link';
import { Phone, Mail, MapPin, MoreVertical, Briefcase, Star, TrendingUp, ChevronRight, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PaginationControl } from '@/components/ui/pagination-control';

interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    phone?: string | null;
    email?: string | null;
    contactName?: string | null;
    taxId?: string | null;
    address?: string | null;
    _count?: {
        purchases: number;
    };
}

interface SupplierGridProps {
    suppliers: Supplier[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
    // Extract province from address if possible (Thai pattern)
    const province = supplier.address?.split(' จ.')[1]?.split(' ')[0] ||
        supplier.address?.split('จังหวัด')[1]?.split(' ')[0] ||
        'ไม่ระบุพื้นที่';

    return (
        <Card className="relative overflow-hidden border-border/40 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all group rounded-2xl bg-gradient-to-br from-background to-muted/5">
            <CardContent className="p-0">
                <div className="p-6 space-y-6">
                    {/* Header Section */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-500">
                                <Briefcase className="h-7 w-7" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight transition-colors group-hover:text-primary line-clamp-1">
                                    {supplier.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    {supplier.code && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">
                                            {supplier.code}
                                        </span>
                                    )}
                                    {supplier.contactName && (
                                        <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                                            <Star className="h-3 w-3 fill-amber-600" />
                                            {supplier.contactName}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-2">
                                <DropdownMenuItem asChild className="rounded-lg">
                                    <Link href={`/suppliers/${supplier.id}`}>ดูรายละเอียด</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="rounded-lg">
                                    <Link href={`/suppliers/${supplier.id}/edit`}>แก้ไขข้อมูล</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-6 py-2">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">
                                <Phone className="h-3 w-3" /> ติดต่อ
                            </div>
                            <div className="text-sm font-bold text-foreground truncate">
                                {supplier.phone || 'ไม่ระบุเบอร์โทร'}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">
                                <TrendingUp className="h-3 w-3" /> งานที่ผูก
                            </div>
                            <div className="text-sm font-bold text-foreground flex items-baseline gap-1">
                                {supplier._count?.purchases || 0}
                                <span className="text-[10px] font-bold text-muted-foreground/60">รายการสั่งซื้อ</span>
                            </div>
                        </div>
                    </div>

                    {/* Secondary Info */}
                    <div className="grid grid-cols-2 gap-6 pt-2 border-t border-border/40">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">
                                <ShieldCheck className="h-3 w-3" /> TAX ID
                            </div>
                            <div className="text-[11px] font-medium text-muted-foreground font-mono">
                                {supplier.taxId ? `${supplier.taxId.slice(0, 3)}-XXXX-${supplier.taxId.slice(-4)}` : 'ไม่ระบุเลขภาษี'}
                            </div>
                        </div>
                        <div className="space-y-2 text-right">
                            <div className="flex items-center justify-end gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 text-right">
                                <MapPin className="h-3 w-3" /> พื้นที่
                            </div>
                            <div className="text-[11px] font-bold text-muted-foreground truncate">
                                {province}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Area */}
                <div className="bg-muted/30 px-6 py-3 flex items-center justify-between border-t border-border/40">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium truncate flex-1 mr-4">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{supplier.email || 'ไม่มีอีเมล'}</span>
                    </div>
                    <Link
                        href={`/suppliers/${supplier.id}`}
                        className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:gap-2 transition-all shrink-0"
                    >
                        จัดการ <ChevronRight className="h-3 w-3" />
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}

export function SupplierGrid({ suppliers, pagination }: SupplierGridProps) {
    if (suppliers.length === 0) {
        return (
            <EmptyState
                icon={<Briefcase className="h-12 w-12 text-muted-foreground/50" />}
                title="ยังไม่มีผู้จำหน่าย"
                description="เริ่มเพิ่มผู้จำหน่ายเพื่อจัดการการซื้อและคลังสินค้าของคุณ"
            />
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {suppliers.map((supplier) => (
                    <SupplierCard key={supplier.id} supplier={supplier} />
                ))}
            </div>

            <PaginationControl pagination={pagination} className="mt-8" />
        </div>
    );
}
