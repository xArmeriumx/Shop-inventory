'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ProductIntelligenceSummary } from '@/types/intelligence';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Package, ShieldCheck, ShoppingCart, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientDate } from '@/components/ui/client-date';

interface IntelligenceSummaryCardsProps {
    summary?: ProductIntelligenceSummary;
    isLoading?: boolean;
}

export function IntelligenceSummaryCards({ summary, isLoading }: IntelligenceSummaryCardsProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="bg-muted/50">
                        <CardContent className="p-4">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-8 w-32" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!summary) return null;

    const cards = [
        {
            label: 'Inventory on Hand',
            value: formatNumber(summary.onHand),
            subValue: `Reserved: ${formatNumber(summary.reserved)}`,
            icon: Package,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            label: 'Units Available',
            value: formatNumber(summary.available),
            subValue: 'Ready to Sell',
            icon: ShieldCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            label: 'Current Cost (WAC)',
            value: formatCurrency(summary.currentWac),
            subValue: `Latest: ${formatCurrency(summary.latestCost)}`,
            icon: DollarSign,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
        },
        {
            label: 'Sale Price',
            value: formatCurrency(summary.latestSalePrice),
            subValue: `Margin: ${formatNumber(((summary.latestSalePrice - summary.currentWac) / summary.latestSalePrice) * 100)}%`,
            icon: TrendingUp,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, i) => (
                    <Card key={i} className="overflow-hidden border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${card.bgColor} ${card.color}`}>
                                <card.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{card.label}</p>
                                <h3 className="text-xl font-bold tracking-tight">{card.value}</h3>
                                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{card.subValue}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {summary.lastMovementDate && (
                <div className="flex items-center gap-2 px-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                        Last movement recorded: <ClientDate date={summary.lastMovementDate} />
                    </p>
                </div>
            )}
        </div>
    );
}
