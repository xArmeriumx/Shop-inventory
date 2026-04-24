'use client';

import { SupplierIntelligenceDTO } from '@/types/intelligence';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, Tag, Timer, ShoppingCart, Info, ExternalLink } from 'lucide-react';
import { ClientDate } from '@/components/ui/client-date';
import Link from 'next/link';

interface VendorIntelligencePanelProps {
    vendors: SupplierIntelligenceDTO[];
    isLoading?: boolean;
}

export function VendorIntelligencePanel({ vendors, isLoading }: VendorIntelligencePanelProps) {
    if (isLoading) {
        return (
            <Card className="border-none shadow-sm shadow-slate-200/50">
                <CardHeader className="pb-2 px-4 pt-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" />
                        Vendor Intelligence
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                    <div className="h-24 bg-muted animate-pulse rounded-lg" />
                </CardContent>
            </Card>
        );
    }

    if (vendors.length === 0) {
        return (
            <Card className="border-none shadow-sm shadow-slate-200/50 bg-slate-50/50">
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                    <Info className="w-8 h-8 text-slate-300 mb-2" />
                    <h4 className="text-sm font-semibold text-slate-600">No Vendor Context Linked</h4>
                    <p className="text-xs text-slate-400 max-w-[250px]">
                        Link this product to suppliers to track vendor-specific SKUs, MOQs, and lead times.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-sm shadow-slate-200/50 overflow-hidden">
            <CardHeader className="pb-2 px-4 pt-4 bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-primary" />
                        Vendor Intelligence
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-white text-slate-500 border-slate-200">
                        {vendors.length} Suppliers
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50/30">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-[10px] font-bold uppercase py-2 px-4">Supplier</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase py-2">Vendor SKU</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase py-2 text-right">MOQ</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase py-2 text-right">Lead Time</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase py-2 text-right">Purchase Price</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase py-2 text-right">Last Bought</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {vendors.map((vendor) => (
                            <TableRow key={vendor.id} className="group hover:bg-slate-50/50">
                                <TableCell className="py-3 px-4">
                                    <Link
                                        href={`/suppliers/${vendor.supplierId}`}
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-primary transition-colors"
                                    >
                                        {vendor.supplierName}
                                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </TableCell>
                                <TableCell className="py-3">
                                    <div className="flex items-center gap-1.5">
                                        <Tag className="w-3 h-3 text-slate-400" />
                                        <span className="text-xs font-medium text-slate-600">{vendor.vendorSku || '—'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                    <span className="text-xs font-bold text-slate-700">{formatNumber(vendor.moq || 0)}</span>
                                    <span className="text-[10px] text-slate-400 ml-1">units</span>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Timer className="w-3 h-3 text-amber-500" />
                                        <span className="text-xs font-bold text-slate-700">{vendor.leadTime || 0}</span>
                                        <span className="text-[10px] text-slate-400">days</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-primary">{formatCurrency(vendor.vendorPrice || 0)}</span>
                                        {vendor.lastPurchasePrice && vendor.lastPurchasePrice !== vendor.vendorPrice && (
                                            <span className="text-[9px] text-muted-foreground line-through opacity-70">
                                                {formatCurrency(vendor.lastPurchasePrice)}
                                            </span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                    {vendor.lastPurchasedDate ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-semibold text-slate-600">
                                                <ClientDate date={vendor.lastPurchasedDate} />
                                            </span>
                                            <p className="text-[9px] text-slate-400 uppercase font-medium">History Trace</p>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">Never</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
