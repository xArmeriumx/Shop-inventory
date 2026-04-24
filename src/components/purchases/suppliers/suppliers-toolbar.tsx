'use client';

import { Search, Plus, LayoutGrid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

export function SuppliersToolbar({ initialSearch = '' }: { initialSearch?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [isPending, startTransition] = useTransition();

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set('search', value);
            } else {
                params.delete('search');
            }
            params.set('page', '1');
            router.push(`/suppliers?${params.toString()}`);
        });
    };

    const handleViewChange = (view: 'grid' | 'table') => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('view', view);
            router.push(`/suppliers?${params.toString()}`);
        });
    };

    const currentView = searchParams.get('view') || 'grid';

    return (
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-4">
            <div className="flex flex-1 items-center gap-4 w-full">
                <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาผู้จำหน่าย (ชื่อ, รหัส, เบอร์โทร)..."
                        className="pl-9 bg-background/50 backdrop-blur-sm transition-all focus:bg-background h-11 rounded-xl"
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                    {isPending && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
                    <Button
                        variant={currentView === 'grid' ? 'secondary' : 'ghost'}
                        size="icon"
                        className={`h-9 w-9 rounded-lg ${currentView === 'grid' ? 'shadow-sm' : ''}`}
                        onClick={() => handleViewChange('grid')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={currentView === 'table' ? 'secondary' : 'ghost'}
                        size="icon"
                        className={`h-9 w-9 rounded-lg ${currentView === 'table' ? 'shadow-sm' : ''}`}
                        onClick={() => handleViewChange('table')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
                <Button asChild className="flex-1 md:flex-none h-11 rounded-xl shadow-lg shadow-primary/10 transition-all hover:shadow-primary/20">
                    <Link href="/suppliers/new">
                        <Plus className="h-4 w-4 mr-2" />
                        เพิ่มผู้จำหน่าย
                    </Link>
                </Button>
            </div>
        </div>
    );
}
