'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardCheck } from 'lucide-react';
import { StockTakeSetupModal } from '@/components/inventory/stock-take-setup-modal';
import { Guard } from '@/components/core/auth/guard';

interface StartStockTakeButtonProps {
    productIds: string[];
    inventoryMode: string;
    warehouses: any[];
}

export function StartStockTakeButton({ productIds, inventoryMode, warehouses }: StartStockTakeButtonProps) {
    const [open, setOpen] = useState(false);

    return (
        <Guard permission={"STOCK_TAKE_CREATE" as any}>
            <Button
                variant="outline"
                className="text-primary border-primary/20 hover:bg-primary/5"
                onClick={() => setOpen(true)}
            >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                เริ่มตรวจนับสต็อก ({productIds.length})
            </Button>

            <StockTakeSetupModal
                open={open}
                onOpenChange={setOpen}
                productIds={productIds}
                totalCount={productIds.length}
                inventoryMode={inventoryMode}
                warehouses={warehouses}
            />
        </Guard>
    );
}
