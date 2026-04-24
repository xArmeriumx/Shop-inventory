import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { getWarehousesAction } from '@/actions/inventory/warehouse.actions';
import { ProductService } from '@/services/inventory/product.service';
import { requireShop } from '@/lib/auth-guard';
import { StockTransferForm } from '@/components/inventory/transfers/stock-transfer-form';
import { BackPageHeader } from '@/components/ui/back-page-header';

export const metadata: Metadata = {
    title: 'สร้างใบโอนสินค้า | ERP System',
};

export default async function NewStockTransferPage() {
    await requirePermission('PRODUCT_UPDATE');
    const context = await requireShop();

    const [warehousesResult, products] = await Promise.all([
        getWarehousesAction(),
        ProductService.getForPurchase(context as any) // Use getForPurchase to see all saleable items
    ]);

    const warehouses = warehousesResult.success ? warehousesResult.data : [];

    return (
        <div className="container mx-auto py-6 max-w-5xl">
            <BackPageHeader
                title="สร้างใบโอนสินค้าใหม่"
                description="ย้ายสินค้าข้ามคลังเพื่อสำรองสต็อกหรือกระจายสินค้า"
                backHref="/inventory/transfers"
            />

            <div className="mt-6">
                <StockTransferForm
                    warehouses={warehouses}
                    products={products}
                />
            </div>
        </div>
    );
}
