'use client';

import { SearchToolbar } from '@/components/ui/search-toolbar';

interface CustomersToolbarProps {
  search: string;
}

export function CustomersToolbar({ search }: CustomersToolbarProps) {
  return <SearchToolbar search={search} placeholder="ค้นหาลูกค้า..." />;
}
