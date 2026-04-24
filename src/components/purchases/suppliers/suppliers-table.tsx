'use client';

import Link from 'next/link';
import { Edit, Trash2, Plus, Package } from 'lucide-react';
import { deleteSupplier, getSupplierDeletionImpact } from '@/actions/purchases/suppliers.actions';
import { useState, useTransition } from 'react';
import { PermissionGuard } from '@/components/core/auth/permission-guard';
import { DeleteEntityDialog } from '@/components/ui/delete-entity-dialog';
import { toast } from 'sonner';
import { Permission } from '@prisma/client';
import { useRouter } from 'next/navigation';
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

export function SuppliersTable({ suppliers, pagination }: SuppliersTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isImpactLoading, setIsImpactLoading] = useState(false);
    const [impactData, setImpactData] = useState<any>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [targetEntity, setTargetEntity] = useState<{ id: string; name: string } | null>(null);

    const openDeleteDialog = async (id: string, name: string) => {
        setTargetEntity({ id, name });
        setShowDeleteDialog(true);
        setIsImpactLoading(true);
        try {
            const result = await getSupplierDeletionImpact(id);
            if (result.success) {
                setImpactData(result.data);
            }
        } catch (err) {
            console.error('Failed to get impact:', err);
        } finally {
            setIsImpactLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!targetEntity) return;

        startTransition(async () => {
            try {
                const result = await deleteSupplier(targetEntity.id);
                if (result.success) {
                    toast.success(result.message);
                    setShowDeleteDialog(false);
                    router.refresh();
                } else {
                    toast.error(result.message);
                }
            } catch (err) {
                toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
            }
        });
    };

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
                                <div className="flex items-center justify-end gap-1">
                                    <PermissionGuard permission={(Permission as any).SUPPLIER_UPDATE}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" asChild title="แก้ไข">
                                            <Link href={`/suppliers/${supplier.id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </PermissionGuard>

                                    <Button variant="ghost" size="sm" asChild className="text-xs h-8 px-3 font-bold hover:bg-primary/10 hover:text-primary transition-colors">
                                        <Link href={`/suppliers/${supplier.id}`}>รายละเอียด</Link>
                                    </Button>

                                    <PermissionGuard permission={(Permission as any).SUPPLIER_DELETE}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                            onClick={() => openDeleteDialog(supplier.id, supplier.name)}
                                            disabled={isPending}
                                            title="ลบ"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </PermissionGuard>
                                </div>
                            </div>
                        ))}

                        <div className="p-6 bg-muted/10">
                            <PaginationControl pagination={pagination} />
                        </div>
                    </div>
                )}
            </CardContent>
            <DeleteEntityDialog
                isOpen={showDeleteDialog}
                onClose={() => {
                    setShowDeleteDialog(false);
                    setImpactData(null);
                }}
                onConfirm={handleConfirmDelete}
                title="ลบข้อมูลผู้จำหน่าย"
                entityName={targetEntity?.name || ''}
                impact={impactData}
                isLoading={isPending}
            />
        </Card>
    );
}
