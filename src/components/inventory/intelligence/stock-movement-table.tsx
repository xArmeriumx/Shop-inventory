'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { StockMovementDTO } from '@/types/intelligence';
import { formatNumber } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/ui/client-date';
import { ArrowUpRight, ArrowDownLeft, RefreshCcw, ClipboardList, PackagePlus, MinusCircle, Link as LinkIcon, User } from 'lucide-react';
import Link from 'next/link';

interface StockMovementTableProps {
    logs: StockMovementDTO[];
    isLoading?: boolean;
}

const TYPE_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
    SALE: { label: 'Sale Doc', color: 'bg-green-50 text-green-700 border-green-200', icon: ArrowUpRight },
    DELIVERY: { label: 'Delivery Receipt', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackagePlus },
    PURCHASE: { label: 'Purchase Receipt', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowDownLeft },
    RETURN: { label: 'Return', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: RefreshCcw },
    ADJUSTMENT: { label: 'Adjustment', color: 'bg-gray-50 text-gray-700 border-gray-200', icon: ClipboardList },
    STOCK_TAKE: { label: 'Stock Take Reconcile', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: PackagePlus },
    INITIAL: { label: 'Initial Balance', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: PackagePlus },
};

export function StockMovementTable({ logs, isLoading }: StockMovementTableProps) {
    if (isLoading) {
        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Actor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <TableRow key={i}>
                                <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-6 w-32 bg-muted animate-pulse rounded-full" /></TableCell>
                                <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                                <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-lg border border-dashed">
                <PackagePlus className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No stock movements recorded yet</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-white overflow-hidden shadow-sm">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[140px] text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Movement Type</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Change</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wider">Balance</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Source Document</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider">Actor</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => {
                        const config = TYPE_CONFIG[log.referenceType] || { label: log.type, color: 'bg-slate-100', icon: MinusCircle };
                        const Icon = config.icon;
                        const isPositive = log.quantity > 0;

                        return (
                            <TableRow key={log.id} className="hover:bg-muted/5 group">
                                <TableCell className="text-sm">
                                    <ClientDate date={log.date} />
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={`font-medium py-1 px-2 flex items-center gap-1.5 w-fit border shadow-none ${config.color}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {config.label}
                                    </Badge>
                                    {log.note && (
                                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] truncate" title={log.note}>
                                            {log.note}
                                        </p>
                                    )}
                                </TableCell>
                                <TableCell className={`text-right font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}{formatNumber(log.quantity)}
                                </TableCell>
                                <TableCell className="text-right font-medium text-sm">
                                    {formatNumber(log.balance)}
                                </TableCell>
                                <TableCell>
                                    {log.referenceId ? (
                                        <Link
                                            href={getLinkForRef(log.referenceType, log.referenceId)}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline group-hover:translate-x-0.5 transition-transform"
                                        >
                                            <LinkIcon className="w-3 h-3" />
                                            {log.referenceNo}
                                        </Link>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                        <User className="w-3 h-3 text-slate-400" />
                                        {log.actorName}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {/* Action or Tooltip can go here */}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function getLinkForRef(type: string, id: string) {
    switch (type) {
        case 'SALE': return `/sales/${id}`;
        case 'DELIVERY': return `/delivery-orders/${id}`; // ★ NEW: Link to DO
        case 'PURCHASE': return `/purchases/${id}`;
        case 'RETURN': return `/returns/${id}`;
        case 'STOCK_TAKE': return `/inventory/stock-take/${id}`;
        default: return '#';
    }
}
