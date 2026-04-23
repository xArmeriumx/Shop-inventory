'use client';

import { TableView, Column } from '@/components/ui/table-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, MapPin, Building2, Star } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';
import { useState } from 'react';
import { WarehouseFormModal } from './warehouse-form-modal';

interface WarehouseListProps {
    warehouses: any[];
}

export function WarehouseList({ warehouses: initialWarehouses }: WarehouseListProps) {
    const [warehouses, setWarehouses] = useState(initialWarehouses);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);

    const columns: Column<any>[] = [
        {
            header: 'รหัสคลัง',
            accessor: (row) => (
                <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-bold text-primary">{row.code}</span>
                    {row.isDefault && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0">
                            <Star className="h-3 w-3 mr-1 fill-amber-500" /> หลัก
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            header: 'ชื่อคลังสินค้า',
            accessor: (row) => (
                <div className="flex flex-col">
                    <span className="font-semibold">{row.name}</span>
                </div>
            ),
        },
        {
            header: 'ที่อยู่',
            accessor: (row) => (
                <div className="flex items-center text-muted-foreground max-w-[300px]">
                    <MapPin className="h-3 w-3 mr-1 shrink-0" />
                    <span className="truncate text-sm">{row.address || 'ไม่ระบุ'}</span>
                </div>
            ),
        },
        {
            header: 'สถานะ',
            accessor: (row) => (
                <Badge variant={row.isActive ? 'default' : 'secondary'} className={row.isActive ? 'bg-green-600' : ''}>
                    {row.isActive ? 'ใช้งาน' : 'ระงับ'}
                </Badge>
            ),
        },
        {
            header: 'วันที่สร้าง',
            accessor: (row) => <span className="text-sm text-muted-foreground">{formatDate(row.createdAt)}</span>,
        },
        {
            header: '',
            accessor: (row) => (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSelectedWarehouse(row);
                            setIsModalOpen(true);
                        }}
                    >
                        <Edit2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="คลังสินค้า (Warehouses)"
                    description="จัดการสถานที่จัดเก็บสินค้าภายในร้าน เพื่อการทำสต็อกแยกสาขาหรือแยกแผนก"
                />
                <Button onClick={() => {
                    setSelectedWarehouse(null);
                    setIsModalOpen(true);
                }}>
                    + เพิ่มคลังสินค้า
                </Button>
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <TableView
                    items={warehouses}
                    columns={columns}
                    keyExtractor={(item) => item.id}
                />
            </div>

            <WarehouseFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                initialData={selectedWarehouse}
            />
        </div>
    );
}
