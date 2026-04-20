'use client';

import {
    Phone,
    Mail,
    MoreVertical,
    User,
    LineChart,
    ExternalLink,
    Pencil,
    Trash2,
    Calendar,
    Wallet
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { formatCurrency } from '@/lib/formatters';

export interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    groupCode: string | null;
    totalVolume: number;
    _count: {
        sales: number;
    };
}

interface CustomerCardProps {
    customer: Customer;
}

export function CustomerCard({ customer }: CustomerCardProps) {
    const isVip = customer.groupCode?.toUpperCase() === 'VIP' || customer.totalVolume > 100000;

    return (
        <Card className="group relative overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 rounded-[2rem] bg-background">
            {/* Soft decorative background gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full -ml-12 -mb-12 blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />

            <CardContent className="p-0 relative">
                {/* Header Information */}
                <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
                            <User className="h-8 w-8" />
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/80">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 p-2 rounded-2xl shadow-xl border-border/40">
                                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary py-2.5">
                                        <Link href={`/customers/${customer.id}`}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            <span className="font-medium">ดูโปรไฟล์ฉบับเต็ม</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary py-2.5">
                                        <Link href={`/customers/${customer.id}/edit`}>
                                            <Pencil className="mr-2 h-4 w-4" />
                                            <span className="font-medium">แก้ไขข้อมูลลูกค้า</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-2" />
                                    <DropdownMenuItem className="text-destructive focus:text-white focus:bg-destructive rounded-xl py-2.5">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span className="font-bold">ลบลูกค้าออกจากระบบ</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Badge variant={isVip ? "default" : "secondary"} className={`text-[10px] font-black uppercase tracking-[0.1em] h-6 px-3 rounded-full border-none ${isVip ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-muted/80'}`}>
                                {isVip ? 'VIP Tier' : (customer.groupCode || 'General')}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                            {customer.name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5 lowercase">
                            <Mail className="h-3 w-3" />
                            {customer.email || 'no-email@store.com'}
                        </p>
                    </div>
                </div>

                {/* Primary Metrics Grid */}
                <div className="mx-6 p-4 rounded-3xl bg-muted/30 border border-border/20 grid grid-cols-2 gap-4">
                    <div className="space-y-1 border-r border-border/40">
                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                            <Wallet className="h-3 w-3" /> ยอดสะสม
                        </span>
                        <div className="text-[15px] font-black text-primary">
                            {formatCurrency(customer.totalVolume)}
                        </div>
                    </div>
                    <div className="space-y-1 pl-2">
                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> ความถี่
                        </span>
                        <div className="text-[15px] font-black text-foreground">
                            {customer._count.sales} <span className="text-[10px] font-bold text-muted-foreground">ครั้ง</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Footer */}
                <div className="p-6 pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Phone className="h-4 w-4" />
                        </div>
                        {customer.phone || '0XX-XXX-XXXX'}
                    </div>

                    <Button variant="ghost" size="sm" className="rounded-full text-xs font-black text-primary hover:bg-primary/10 hover:text-primary px-4 group/btn" asChild>
                        <Link href={`/customers/${customer.id}`}>
                            รายละเอียด <ExternalLink className="ml-1.5 h-3 w-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
