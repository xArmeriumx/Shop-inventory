'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type FilterUpdates = Record<string, string>;

// ─── useUrlFilters ───────────────────────────────────────────────────────────

/**
 * Centralizes the URL-based filter/search logic used across all toolbar components.
 * Replaces the repeated `updateParams → router.push` pattern in every toolbar.
 *
 * @example
 * const { updateFilters, clearFilters, isPending } = useUrlFilters();
 * updateFilters({ search: 'foo', page: '1' });
 */
export function useUrlFilters() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    /** Update one or more URL params and reset to page 1 */
    const updateFilters = useCallback(
        (updates: FilterUpdates) => {
            const params = new URLSearchParams(searchParams.toString());

            Object.entries(updates).forEach(([key, value]) => {
                if (value) {
                    params.set(key, value);
                } else {
                    params.delete(key);
                }
            });

            // Always reset to page 1 when any filter changes
            params.delete('page');

            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
            });
        },
        [pathname, router, searchParams]
    );

    /** Change page without touching any other filter */
    const goToPage = useCallback(
        (page: number) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
            });
        },
        [pathname, router, searchParams]
    );

    /** Clear all filters and return to the base path */
    const clearFilters = useCallback(() => {
        startTransition(() => {
            router.push(pathname);
        });
    }, [pathname, router]);

    return { updateFilters, goToPage, clearFilters, isPending };
}
