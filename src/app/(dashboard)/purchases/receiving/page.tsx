import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getPendingReceiving, getPurchaseReceipts } from '@/actions/purchases/purchase-receipt.actions';
import { ReceivingTable } from '@/components/purchases/receiving/receiving-table';
import { ReceiptHistoryTable } from '@/components/purchases/receiving/receipt-history-table';
import { PurchaseStatus } from '@/types/domain';
import { PackageSearch, History } from 'lucide-react';

interface ReceivingPageProps {
  searchParams: {
    tab?: string;
    page?: string;
  };
}

export default async function ReceivingPage({ searchParams }: ReceivingPageProps) {
  const currentTab = searchParams.tab || 'pending';
  const page = Number(searchParams.page) || 1;

  // Fetch pending POs (ORDERED or PARTIALLY_RECEIVED)
  const pendingResult = await getPendingReceiving({
    page: currentTab === 'pending' ? page : 1,
  });

  // Fetch receipt history
  const historyResult = await getPurchaseReceipts({
    page: currentTab === 'history' ? page : 1,
  });

  const pendingPOs = pendingResult.success ? pendingResult.data.data : [];
  const receipts = historyResult.success ? historyResult.data.data : [];
  const pendingPagination = pendingResult.success ? pendingResult.data.pagination : null;
  const historyPagination = historyResult.success ? historyResult.data.pagination : null;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="คลังสินค้าขาเข้า (Receiving)" 
        description="จัดการการรับสินค้าจากการซื้อและตรวจสอบความถูกต้องของสินค้า"
      />

      <Tabs defaultValue={currentTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <PackageSearch className="w-4 h-4" />
            รายการรอรับสินค้า
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            ประวัติการรับสินค้า
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <ReceivingTable 
            data={pendingPOs} 
            pagination={pendingPagination} 
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ReceiptHistoryTable 
            data={receipts} 
            pagination={historyPagination} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
