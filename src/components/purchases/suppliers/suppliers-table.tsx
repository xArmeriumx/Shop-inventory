import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControl } from '@/components/ui/pagination-control';

interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    phone?: string | null;
    email?: string | null;
}

interface SuppliersTableProps {
    suppliers: Supplier[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
    search?: string;
}

export function SuppliersTable({ suppliers, pagination, search = '' }: SuppliersTableProps) {
    return (
        <Card className="rounded-2xl overflow-hidden border-border/40 shadow-xl shadow-primary/5">
            <CardHeader className="bg-muted/50 border-b border-border/40">
                <CardTitle className="text-lg font-bold">รายการผู้จำหน่าย</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {suppliers.length === 0 ? (
                    <div className="p-12">
                        <EmptyState
                            icon={<Package className="h-12 w-12" />}
                            title="ยังไม่มีผู้จำหน่าย"
                            description="เริ่มเพิ่มผู้จำหน่ายเพื่อติดตามการสั่งซื้อ"
                            action={
                                <Button asChild className="rounded-xl">
                                    <Link href="/suppliers/new"><Plus className="h-4 w-4 mr-2" />เพิ่มผู้จำหน่ายแรก</Link>
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {suppliers.map((supplier) => (
                            <div
                                key={supplier.id}
                                className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-colors"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-foreground hover:text-primary transition-colors">
                                            <Link href={`/suppliers/${supplier.id}`}>{supplier.name}</Link>
                                        </h3>
                                        {supplier.code && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 bg-muted px-2 py-0.5 rounded">{supplier.code}</span>}
                                    </div>
                                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground font-medium">
                                        {supplier.phone && <span className="flex items-center gap-1.5">📞 {supplier.phone}</span>}
                                        {supplier.email && <span className="flex items-center gap-1.5">✉️ {supplier.email}</span>}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" asChild className="rounded-xl border-border/50 text-xs font-bold">
                                    <Link href={`/suppliers/${supplier.id}`}>ดูรายละเอียด</Link>
                                </Button>
                            </div>
                        ))}

                        <div className="p-6 bg-muted/10">
                            <PaginationControl pagination={pagination} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
