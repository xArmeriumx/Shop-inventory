'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Search, RotateCcw, Plus, Minus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { getReturnableSaleItems, createReturn } from '@/actions/returns';
import { getSales } from '@/actions/sales';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReturnableItem {
  saleItemId: string;
  productId: string;
  productName: string;
  productSku: string | null;
  originalQuantity: number;
  alreadyReturned: number;
  maxReturnable: number;
  salePrice: number;
  netPerUnit: number;
}

interface SelectedReturnItem extends ReturnableItem {
  returnQuantity: number;
  refundPerUnit: number;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ReturnForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSaleId = searchParams.get('saleId') || '';

  const [isPending, startTransition] = useTransition();

  // Step 1: Search sale
  const [saleSearch, setSaleSearch] = useState('');
  const [saleResults, setSaleResults] = useState<any[]>([]);
  const [selectedSaleId, setSelectedSaleId] = useState(initialSaleId);
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Step 2: Returnable items
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedReturnItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Step 3: Return details
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<string>('');
  const [error, setError] = useState('');

  // ── Search Sales ──────────────────────────────────────────────────────

  const handleSearchSale = useCallback(async () => {
    if (!saleSearch.trim()) return;
    setIsSearching(true);
    try {
      const result = await getSales({
        page: 1,
        limit: 10,
        search: saleSearch.trim(),
      });
      setSaleResults(result.data.filter((s: any) => s.status !== 'CANCELLED'));
    } catch {
      setSaleResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [saleSearch]);

  // ── Select Sale → Load Returnable Items ──────────────────────────────

  const handleSelectSale = useCallback(async (saleId: string, invoiceNumber: string) => {
    setSelectedSaleId(saleId);
    setSelectedInvoice(invoiceNumber);
    setSaleResults([]);
    setSaleSearch('');
    setSelectedItems([]);
    setIsLoadingItems(true);

    try {
      const items = await getReturnableSaleItems(saleId);
      setReturnableItems(items || []);
    } catch {
      setReturnableItems([]);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  // Auto-load if saleId is in URL
  useState(() => {
    if (initialSaleId) {
      handleSelectSale(initialSaleId, '');
    }
  });

  // ── Add/Remove Items ──────────────────────────────────────────────────

  const addItem = (item: ReturnableItem) => {
    if (selectedItems.find(si => si.saleItemId === item.saleItemId)) return;
    setSelectedItems(prev => [...prev, {
      ...item,
      returnQuantity: 1,
      refundPerUnit: item.netPerUnit,
    }]);
  };

  const removeItem = (saleItemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.saleItemId !== saleItemId));
  };

  const updateQuantity = (saleItemId: string, qty: number) => {
    setSelectedItems(prev => prev.map(i =>
      i.saleItemId === saleItemId
        ? { ...i, returnQuantity: Math.min(Math.max(1, qty), i.maxReturnable) }
        : i
    ));
  };

  const updateRefundPerUnit = (saleItemId: string, amount: number) => {
    setSelectedItems(prev => prev.map(i =>
      i.saleItemId === saleItemId
        ? { ...i, refundPerUnit: Math.max(0, amount) }
        : i
    ));
  };

  // ── Calculate Totals ──────────────────────────────────────────────────

  const totalRefund = selectedItems.reduce(
    (sum, i) => sum + (i.returnQuantity * i.refundPerUnit), 0
  );

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    setError('');

    if (!selectedSaleId) { setError('กรุณาเลือกบิลขาย'); return; }
    if (selectedItems.length === 0) { setError('กรุณาเลือกสินค้าอย่างน้อย 1 รายการ'); return; }
    if (!reason.trim()) { setError('กรุณาระบุเหตุผล'); return; }
    if (!refundMethod) { setError('กรุณาเลือกวิธีคืนเงิน'); return; }

    startTransition(async () => {
      const result = await createReturn({
        saleId: selectedSaleId,
        reason: reason.trim(),
        refundMethod: refundMethod as 'CASH' | 'TRANSFER' | 'CREDIT',
        items: selectedItems.map(i => ({
          saleItemId: i.saleItemId,
          productId: i.productId,
          quantity: i.returnQuantity,
          refundPerUnit: i.refundPerUnit,
        })),
      });

      if (result.success) {
        router.push('/returns');
      } else {
        setError(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/returns">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">คืนสินค้า</h1>
      </div>

      {/* Step 1: Select Sale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. เลือกบิลขาย</CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSaleId ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  บิล: {selectedInvoice || selectedSaleId}
                </p>
                <p className="text-sm text-muted-foreground">
                  สินค้าที่คืนได้: {returnableItems.length} รายการ
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedSaleId('');
                setSelectedInvoice('');
                setReturnableItems([]);
                setSelectedItems([]);
              }}>
                เปลี่ยนบิล
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="ค้นหาด้วยเลขบิล หรือชื่อลูกค้า..."
                  value={saleSearch}
                  onChange={(e) => setSaleSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSale()}
                />
                <Button onClick={handleSearchSale} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-1" />
                  ค้นหา
                </Button>
              </div>
              {saleResults.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {saleResults.map((sale: any) => (
                    <button
                      key={sale.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted transition-colors"
                      onClick={() => handleSelectSale(sale.id, sale.invoiceNumber)}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{sale.invoiceNumber}</span>
                        <span className="text-sm">{formatCurrency(sale.netAmount || sale.totalAmount)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {sale.customerName || sale.customer?.name || 'ลูกค้าทั่วไป'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Select Items */}
      {selectedSaleId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. เลือกสินค้าที่จะคืน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingItems ? (
              <p className="text-muted-foreground">กำลังโหลด...</p>
            ) : returnableItems.length === 0 ? (
              <p className="text-muted-foreground">ไม่มีสินค้าที่คืนได้</p>
            ) : (
              <>
                {/* Available items */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">สินค้าที่คืนได้</Label>
                  <div className="border rounded-lg divide-y">
                    {returnableItems
                      .filter(item => !selectedItems.find(si => si.saleItemId === item.saleItemId))
                      .map(item => (
                        <div key={item.saleItemId} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              คืนได้: {item.maxReturnable} ชิ้น | ราคา: {formatCurrency(item.netPerUnit)}/ชิ้น
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => addItem(item)}>
                            <Plus className="h-3 w-3 mr-1" />
                            เลือก
                          </Button>
                        </div>
                      ))}
                    {returnableItems.filter(item => !selectedItems.find(si => si.saleItemId === item.saleItemId)).length === 0 && (
                      <p className="px-4 py-3 text-sm text-muted-foreground">เลือกครบแล้ว</p>
                    )}
                  </div>
                </div>

                {/* Selected items */}
                {selectedItems.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">สินค้าที่จะคืน ({selectedItems.length})</Label>
                    <div className="border rounded-lg divide-y">
                      {selectedItems.map(item => (
                        <div key={item.saleItemId} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{item.productName}</p>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(item.saleItemId)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">จำนวน</Label>
                              <Button size="icon" variant="outline" className="h-7 w-7"
                                onClick={() => updateQuantity(item.saleItemId, item.returnQuantity - 1)}
                                disabled={item.returnQuantity <= 1}>
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="number"
                                className="w-16 h-7 text-center text-sm"
                                min={1}
                                max={item.maxReturnable}
                                value={item.returnQuantity}
                                onChange={(e) => updateQuantity(item.saleItemId, Number(e.target.value))}
                              />
                              <Button size="icon" variant="outline" className="h-7 w-7"
                                onClick={() => updateQuantity(item.saleItemId, item.returnQuantity + 1)}
                                disabled={item.returnQuantity >= item.maxReturnable}>
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground">/ {item.maxReturnable}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">คืน/ชิ้น</Label>
                              <Input
                                type="number"
                                className="w-24 h-7 text-sm"
                                min={0}
                                step={0.01}
                                value={item.refundPerUnit}
                                onChange={(e) => updateRefundPerUnit(item.saleItemId, Number(e.target.value))}
                              />
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              = {formatCurrency(item.returnQuantity * item.refundPerUnit)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Return Details + Summary */}
      {selectedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. รายละเอียดการคืน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                เหตุผลการคืน <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="ระบุเหตุผลการคืนสินค้า..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>
                วิธีคืนเงิน <span className="text-destructive">*</span>
              </Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกวิธีคืนเงิน" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">เงินสด</SelectItem>
                  <SelectItem value="TRANSFER">เงินโอน</SelectItem>
                  <SelectItem value="CREDIT">เครดิต (หักยอดครั้งหน้า)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">จำนวนสินค้าที่คืน</span>
                <span>{selectedItems.reduce((sum, i) => sum + i.returnQuantity, 0)} ชิ้น</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">ยอดคืนเงินทั้งหมด</span>
                <span className="font-bold text-lg text-green-600">{formatCurrency(totalRefund)}</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full"
              size="lg"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isPending ? 'กำลังดำเนินการ...' : `ยืนยันคืนสินค้า (${formatCurrency(totalRefund)})`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
