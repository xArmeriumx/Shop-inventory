'use client';

import { Search, Plus, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, useEffect, useCallback } from 'react';

export function CustomersToolbar({ initialSearch = '' }: { initialSearch?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();

  // Debounced search logic
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const executeSearch = useCallback((value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      params.set('page', '1');
      router.push(`/customers?${params.toString()}`);
    });
  }, [router, searchParams]);

  // True Debounce Effect
  useEffect(() => {
    if (searchTerm === initialSearch) return;
    const timeout = setTimeout(() => {
      executeSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm, initialSearch, executeSearch]);

  // Keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch(searchTerm);
    }
  };

  const handleViewChange = (view: 'grid' | 'table') => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', view);
      router.push(`/customers?${params.toString()}`);
    });
  };

  const currentView = searchParams.get('view') || 'grid';

  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-4">
      <div className="flex flex-1 items-center gap-4 w-full">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาลูกค้า (ชื่อ, เบอร์โทร)..."
            className="pl-9 bg-background/50 backdrop-blur-sm transition-all focus:bg-background h-11 rounded-xl pr-20"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isPending && (
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-[10px] font-bold uppercase tracking-tight text-muted-foreground hover:text-primary transition-colors"
              onClick={() => executeSearch(searchTerm)}
            >
              ค้นหา
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
          <Button
            variant={currentView === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 rounded-lg ${currentView === 'grid' ? 'shadow-sm bg-background' : ''}`}
            onClick={() => handleViewChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={currentView === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 rounded-lg ${currentView === 'table' ? 'shadow-sm bg-background' : ''}`}
            onClick={() => handleViewChange('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <Button asChild className="flex-1 md:flex-none h-11 rounded-xl shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20 bg-primary hover:bg-primary/90">
          <Link href="/customers/new">
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มลูกค้า
          </Link>
        </Button>
      </div>
    </div>
  );
}
