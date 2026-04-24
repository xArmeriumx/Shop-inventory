'use client';

import Link from 'next/link';
import {
    FileText,
    ArrowRight,
    CheckCircle2,
    Clock,
    ShoppingBag,
    Truck,
    Receipt,
    CreditCard,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';

export interface DocumentNode {
    id: string;
    type: string;
    label: string;
    status: string;
    date: Date | string;
    isCurrent?: boolean;
}

interface RelationshipPanelProps {
    nodes: DocumentNode[];
    className?: string;
}

const TYPE_CONFIG: Record<string, { icon: any, color: string, path: string }> = {
    QUOTE: { icon: FileText, color: 'text-blue-500', path: '/quotes' },
    ORDER_REQUEST: { icon: ShoppingBag, color: 'text-orange-500', path: '/order-requests' },
    SALE: { icon: ShoppingBag, color: 'text-green-600', path: '/sales' },
    PURCHASE: { icon: ShoppingBag, color: 'text-purple-600', path: '/purchases' },
    SHIPMENT: { icon: Truck, color: 'text-indigo-500', path: '/shipments' },
    INVOICE: { icon: Receipt, color: 'text-amber-600', path: '/invoices' },
    PAYMENT: { icon: CreditCard, color: 'text-emerald-600', path: '/payments' },
};

export function RelationshipPanel({ nodes, className }: RelationshipPanelProps) {
    if (nodes.length === 0) return null;

    return (
        <div className={cn("p-4 bg-muted/20 rounded-xl border border-dashed flex items-center flex-wrap gap-y-4", className)}>
            <TooltipProvider>
                {nodes.map((node, idx) => {
                    const config = TYPE_CONFIG[node.type] || { icon: FileText, color: 'text-muted-foreground', path: '#' };
                    const Icon = config.icon;

                    return (
                        <div key={node.id} className="flex items-center">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Link
                                        href={`${config.path}/${node.id}`}
                                        className={cn(
                                            "flex items-center gap-2 p-2 px-3 rounded-lg border transition-all hover:shadow-md",
                                            node.isCurrent ? "bg-background border-primary shadow-sm" : "bg-card hover:bg-muted/50"
                                        )}
                                    >
                                        <div className={cn("p-1.5 rounded-md bg-muted/50", config.color)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-muted-foreground leading-none mb-1">
                                                {node.type}
                                            </span>
                                            <span className="text-xs font-black truncate max-w-[120px]">
                                                {node.label}
                                            </span>
                                        </div>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-20" />
                                    </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs font-bold">{node.label}</p>
                                    <p className="text-[10px] text-muted-foreground">สถานะ: {node.status}</p>
                                </TooltipContent>
                            </Tooltip>

                            {idx < nodes.length - 1 && (
                                <div className="px-2 text-muted-foreground/30">
                                    <ArrowRight className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </TooltipProvider>
        </div>
    );
}
