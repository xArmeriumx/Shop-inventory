'use client';

import { User } from 'lucide-react';
import { PaginationControl } from '@/components/ui/pagination-control';
import { CustomerCard, type Customer } from './customer-card';

interface CustomerGridProps {
    customers: Customer[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

export function CustomerGrid({ customers, pagination }: CustomerGridProps) {
    if (customers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed rounded-[2rem] bg-muted/20">
                <div className="p-5 bg-background rounded-2xl shadow-sm mb-4">
                    <User className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-black tracking-tight">ไม่พบข้อมูลลูกค้า</h3>
                <p className="text-muted-foreground font-medium mt-1">ลองเปลี่ยนคำค้นหา หรือเพิ่มลูกค้าใหม่เข้าสู่ระบบ</p>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {customers.map((customer) => (
                    <CustomerCard key={customer.id} customer={customer} />
                ))}
            </div>

            <div className="pt-4">
                <PaginationControl pagination={pagination} />
            </div>
        </div>
    );
}
