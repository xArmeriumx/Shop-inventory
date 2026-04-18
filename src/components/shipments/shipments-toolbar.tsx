'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Guard } from '@/components/auth/guard';
import { ShipmentScannerDialog } from './shipment-scanner-dialog';
import { getSalesWithoutShipment } from '@/actions/shipments';
import { useUrlFilters } from '@/hooks/use-url-filters';

interface ShipmentsToolbarProps {
  defaultSearch?: string;
  defaultStatus?: string;
}

export function ShipmentsToolbar({ defaultSearch, defaultStatus }: ShipmentsToolbarProps) {
  const router = useRouter();
  const { updateFilters, clearFilters } = useUrlFilters();
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [availableSales, setAvailableSales] = useState<
    { id: string; invoiceNumber: string; customerName: string | null; totalAmount: number }[]
  >([]);

  const handleOpenScan = async () => {
    try {
      const sales = await getSalesWithoutShipment();
      setAvailableSales(sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customer?.name || s.customerName || null,
        totalAmount: s.totalAmount,
      })));
    } catch { setAvailableSales([]); }
    setScanOpen(true);
  };

  const hasFilters = defaultSearch || defaultStatus;

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา เลขจัดส่ง, ชื่อผู้รับ, tracking..."
              className="pl-9"
              defaultValue={defaultSearch}
              onChange={(e) => {
                const value = e.target.value;
                if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                searchTimerRef.current = setTimeout(() => updateFilters({ search: value }), 500);
              }}
            />
          </div>

          {/* Status filter */}
          <Select
            defaultValue={defaultStatus || 'all'}
            onValueChange={(value) => updateFilters({ status: value === 'all' ? '' : value })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="สถานะ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="PENDING">รอจัดส่ง</SelectItem>
              <SelectItem value="SHIPPED">ส่งแล้ว</SelectItem>
              <SelectItem value="DELIVERED">ส่งถึงแล้ว</SelectItem>
              <SelectItem value="RETURNED">ส่งคืน</SelectItem>
              <SelectItem value="CANCELLED">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />ล้าง
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Guard permission="SHIPMENT_CREATE">
            {/* AI Scan Button — opens Dialog instead of navigating */}
            <Button
              variant="outline"
              onClick={handleOpenScan}
              className="border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/20"
            >
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              AI สแกน
            </Button>
            <Button asChild>
              <Link href="/shipments/create">
                <Plus className="h-4 w-4 mr-2" />
                สร้างจัดส่ง
              </Link>
            </Button>
          </Guard>
        </div>
      </div>

      {/* Scanner Dialog */}
      <ShipmentScannerDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        availableSales={availableSales}
        onSuccess={() => {
          setScanOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
