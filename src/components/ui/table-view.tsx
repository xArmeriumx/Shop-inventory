import React from 'react';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
    align?: 'left' | 'center' | 'right';
}

interface TableViewProps<T> {
    title?: string;
    description?: string;
    items: T[];
    columns: Column<T>[];
    keyExtractor: (item: T) => string | number;
    actionButton?: React.ReactNode;
}

export function TableView<T>({
    title,
    description,
    items,
    columns,
    keyExtractor,
    actionButton
}: TableViewProps<T>) {
    return (
        <div className="space-y-6">
            {(title || actionButton) && (
                <div className="flex items-center justify-between">
                    <div>
                        {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                    {actionButton}
                </div>
            )}

            <div className="rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto scrollbar-hide -mx-px">
                    <table className="w-full text-left text-sm border-collapse min-w-[600px] lg:min-w-full">
                        <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground font-bold uppercase tracking-wider text-[10px] lg:text-[11px]">
                                {columns.map((col, i) => (
                                    <th
                                        key={i}
                                        className={cn(
                                            "px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap",
                                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                                            col.className
                                        )}
                                    >
                                        {col.header}
                                    </th>
                                ))}
                                <th className="px-4 lg:px-6 py-3 lg:py-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {items.length > 0 ? (
                                items.map((item) => (
                                    <tr key={keyExtractor(item)} className="group hover:bg-muted/30 transition-colors">
                                        {columns.map((col, j) => {
                                            const content = typeof col.accessor === 'function'
                                                ? col.accessor(item)
                                                : (item[col.accessor] as unknown as React.ReactNode);

                                            return (
                                                <td
                                                    key={j}
                                                    className={cn(
                                                        "px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap",
                                                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                                                    )}
                                                >
                                                    {content}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 lg:px-6 py-3 lg:py-4 text-right">
                                            <button className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors">
                                                <MoreVertical className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length + 1} className="px-4 lg:px-6 py-12 text-center text-muted-foreground italic">
                                        ไม่พบข้อมูลในขณะนี้
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
