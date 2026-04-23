import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { getWarehousesAction } from '@/actions/warehouse';
import { WarehouseList } from '@/components/inventory/warehouses/warehouse-list';

export const metadata: Metadata = {
    title: 'คลังสินค้า | ERP System',
};

export default async function WarehousesPage() {
    await requirePermission('PRODUCT_VIEW');

    const result = await getWarehousesAction();
    const warehouses = result.success ? result.data : [];

    return (
        <div className="container mx-auto py-6">
            <WarehouseList warehouses={warehouses} />
        </div>
    );
}
