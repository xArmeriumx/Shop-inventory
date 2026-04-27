import { getPurchaseOrderForReceiving } from '@/actions/purchases/purchase-receipt.actions';
import { WarehouseService } from '@/services/inventory/warehouse.service';
import { RequestContext } from '@/types/domain';
import { requirePermission } from '@/lib/auth-guard';
import { ReceivePOForm } from '@/components/purchases/receiving/receive-po-form';
import { BackPageHeader } from '@/components/ui/back-page-header';
import { notFound } from 'next/navigation';

interface ReceivePOPageProps {
  params: {
    poId: string;
  };
}

export default async function ReceivePOPage({ params }: ReceivePOPageProps) {
  const ctx = await requirePermission('PURCHASE_CREATE');
  
  const [purchaseResult, warehouses] = await Promise.all([
    getPurchaseOrderForReceiving(params.poId),
    WarehouseService.getWarehouses(ctx as RequestContext)
  ]);

  if (!purchaseResult.success || !purchaseResult.data) {
    notFound();
  }

  const purchase = purchaseResult.data;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <BackPageHeader 
        title={`รับสินค้า: ${purchase.purchaseNumber}`}
        description={`บันทึกการรับสินค้าจาก ${purchase.supplier?.name || purchase.supplierName}`}
        backHref="/purchases/receiving"
      />

      <ReceivePOForm 
        purchase={purchase} 
        warehouses={warehouses} 
      />
    </div>
  );
}
