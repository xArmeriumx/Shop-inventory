import { Metadata } from 'next';
import { requirePermission } from '@/lib/auth-guard';
import { StockTransferService } from '@/services/inventory/stock-transfer.service';
import { requireShop } from '@/lib/auth-guard';
import { StockTransferList } from '@/components/inventory/transfers/stock-transfer-list';

export const metadata: Metadata = {
    title: 'การโอนสินค้า | ERP System',
};

export default async function StockTransfersPage() {
    await requirePermission('PRODUCT_VIEW');
    const context = await requireShop();

    const transfers = await StockTransferService.getTransfers(context as any);

    return (
        <div className="container mx-auto py-6">
            <StockTransferList transfers={transfers} />
        </div>
    );
}
