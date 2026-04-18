'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { StockHistoryTable } from './stock-history-table';

interface Props {
  logs: any[];
  pagination: any;
}

export function StockHistoryTableClientWrapper({ logs, pagination }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('historyPage', String(page));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <StockHistoryTable 
      logs={logs} 
      pagination={pagination} 
      onPageChange={handlePageChange} 
    />
  );
}
