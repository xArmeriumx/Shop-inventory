import { getPurchaseReceipt } from '@/actions/purchases/purchase-receipt.actions';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth-guard';
import { notFound } from 'next/navigation';
import { ReceiptDetailView } from '@/components/purchases/receiving/receipt-detail-view';
import { BackPageHeader } from '@/components/ui/back-page-header';

interface ReceiptDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ReceiptDetailPage({ params }: ReceiptDetailPageProps) {
  const ctx = await requirePermission('PURCHASE_VIEW');
  
  const result = await getPurchaseReceipt(params.id);

  if (!result.success || !result.data) {
    notFound();
  }

  const receipt = result.data;

  // Need shop info for the print builder
  const shop = await db.shop.findUnique({
    where: { id: ctx.shopId }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <BackPageHeader 
        title={`ใบรับสินค้า: ${receipt.receiptNumber}`}
        description={`รับเข้าจาก ${receipt.purchase?.purchaseNumber}`}
        backHref="/purchases/receiving?tab=history"
      />

      <ReceiptDetailView 
        receipt={receipt} 
        shop={shop} 
      />
    </div>
  );
}
