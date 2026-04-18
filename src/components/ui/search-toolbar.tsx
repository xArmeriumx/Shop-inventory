'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useUrlFilters } from '@/hooks/use-url-filters';

interface SearchToolbarProps {
    /** Current search value from URL */
    search?: string;
    placeholder?: string;
}

/**
 * Simple single-field search toolbar.
 * Used by Customers, Suppliers, and any list with only a text search filter.
 */
export function SearchToolbar({ search = '', placeholder = 'ค้นหา...' }: SearchToolbarProps) {
    const { updateFilters, clearFilters, isPending } = useUrlFilters();
    const [value, setValue] = useState(search);

    const handleSearch = () => updateFilters({ search: value });
    const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch(); };
    const handleClear = () => { setValue(''); clearFilters(); };

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-1 gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-9"
                    />
                </div>
                <Button onClick={handleSearch} disabled={isPending}>ค้นหา</Button>
            </div>

            {search && (
                <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="mr-1 h-4 w-4" />ล้างตัวกรอง
                </Button>
            )}
        </div>
    );
}
