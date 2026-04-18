import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface Supplier {
    id: string;
    name: string;
    code?: string | null;
    phone?: string | null;
    email?: string | null;
}

interface SuppliersTableProps {
    suppliers: Supplier[];
    pagination: { page: number; totalPages: number };
    search?: string;
}

export function SuppliersTable({ suppliers, pagination, search = '' }: SuppliersTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>รายการผู้จำหน่าย</CardTitle>
            </CardHeader>
            <CardContent>
                {suppliers.length === 0 ? (
                    <EmptyState
                        icon={<Package className="h-12 w-12" />}
                        title="ยังไม่มีผู้จำหน่าย"
                        description="เริ่มเพิ่มผู้จำหน่ายเพื่อติดตามการสั่งซื้อ"
                        action={
                            <Button asChild>
                                <Link href="/suppliers/new"><Plus className="h-4 w-4 mr-2" />เพิ่มผู้จำหน่ายแรก</Link>
                            </Button>
                        }
                    />
                ) : (
                    <div className="space-y-4">
                        {suppliers.map((supplier) => (
                            <div
                                key={supplier.id}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{supplier.name}</h3>
                                        {supplier.code && <span className="text-xs text-muted-foreground">({supplier.code})</span>}
                                    </div>
                                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                                        {supplier.phone && <span>📞 {supplier.phone}</span>}
                                        {supplier.email && <span>✉️ {supplier.email}</span>}
                                    </div>
                                </div>
                                <Link href={`/suppliers/${supplier.id}`}>
                                    <Button variant="outline" size="sm">ดูรายละเอียด</Button>
                                </Link>
                            </div>
                        ))}

                        {pagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                {pagination.page > 1 && (
                                    <Link href={`/suppliers?page=${pagination.page - 1}${search ? `&search=${search}` : ''}`}>
                                        <Button variant="outline" size="sm">← ก่อนหน้า</Button>
                                    </Link>
                                )}
                                <span className="px-4 py-2 text-sm">หน้า {pagination.page} / {pagination.totalPages}</span>
                                {pagination.page < pagination.totalPages && (
                                    <Link href={`/suppliers?page=${pagination.page + 1}${search ? `&search=${search}` : ''}`}>
                                        <Button variant="outline" size="sm">ถัดไป →</Button>
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
