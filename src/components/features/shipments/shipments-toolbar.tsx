'use client';

import { useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Plus, ScanLine } from 'lucide-react';
import Link from 'next/link';
import { Guard } from '@/components/auth/guard';

interface ShipmentsToolbarProps {
  defaultSearch?: string;
  defaultStatus?: string;
}

export function ShipmentsToolbar({ defaultSearch, defaultStatus }: ShipmentsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset page when filtering
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = defaultSearch || defaultStatus;

  return (
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
              searchTimerRef.current = setTimeout(() => updateFilter('search', value || null), 500);
            }}
          />
        </div>

        {/* Status filter */}
        <Select
          defaultValue={defaultStatus || 'all'}
          onValueChange={(value) => updateFilter('status', value === 'all' ? null : value)}
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

        {/* Clear */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            ล้าง
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Guard permission="SHIPMENT_CREATE">
          <Button variant="outline" asChild>
            <Link href="/shipments/scan">
              <ScanLine className="h-4 w-4 mr-2" />
              สแกนใบเสร็จ
            </Link>
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
  );
}
