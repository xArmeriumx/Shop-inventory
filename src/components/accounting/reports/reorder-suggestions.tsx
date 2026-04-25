'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getReorderSuggestions } from '@/actions/core/analytics.actions';
import { createPRFromSuggestions } from '@/actions/purchases/purchases.actions';
import { Box, AlertCircle, ShoppingCart, Loader2, CheckCircle2, ChevronRight, Package, Truck } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { runActionWithToast } from '@/lib/mutation-utils';
import { cn } from '@/lib/utils';

/**
 * ReorderSuggestions — Interactive procurement heuristics.
 * PATTERN: Uses runActionWithToast for all operational transitions.
 */
export default function ReorderSuggestions() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const loadSuggestions = async () => {
    setLoading(true);
    const result = await getReorderSuggestions();
    if (result.success) {
      const data = result.data;
      setSuggestions(data);
      // Default select high/critical urgency
      const autoSelected = data
        .filter((s: any) => s.urgency === 'CRITICAL' || s.urgency === 'HIGH')
        .map((s: any) => s.productId);
      setSelectedIds(new Set(autoSelected));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === suggestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suggestions.map(s => s.productId)));
    }
  };

  const handleCreatePRs = () => {
    if (selectedIds.size === 0) return;

    const selectedItems = suggestions
      .filter(s => selectedIds.has(s.productId))
      .map(s => ({
        productId: s.productId,
        quantity: s.suggestedUnits,
        supplierId: s.supplierId,
      }));

    startTransition(async () => {
      await runActionWithToast(createPRFromSuggestions(selectedItems), {
        successMessage: `สร้างใบขอซื้อ (Draft PR) ทั้งหมด ${selectedIds.size} รายการสำเร็จ`,
        loadingMessage: "กำลังประมวลผลข้อแนะนำการสั่งซื้อ...",
        onSuccess: () => {
          loadSuggestions();
          setSelectedIds(new Set());
        }
      });
    });
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'CRITICAL':
        return <Badge variant="destructive" className="bg-red-600 animate-pulse">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="destructive">High</Badge>;
      default:
        return <Badge variant="secondary">Medium</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm">
        <CardContent className="h-64 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">กำลังคำนวณความเสี่ยงสต็อกและวิเคราะห์ผู้จำหน่าย...</p>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="border-none shadow-lg bg-emerald-50/30">
        <CardContent className="h-48 flex flex-col items-center justify-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-emerald-700">สต็อกของคุณอยู่ในระดับปกติ</p>
          <p className="text-sm text-emerald-600/70">ยังไม่มีสินค้าที่ต้องการการสั่งซื้อด่วนในขณะนี้</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl overflow-hidden bg-gradient-to-br from-white to-slate-50">
      <CardHeader className="flex flex-row items-center justify-between pb-6">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-indigo-600" />
            ข้อแนะนำการสั่งซื้อ (Reorder Suggestions)
          </CardTitle>
          <CardDescription>
            วิเคราะห์จาก Velocity 30 วันและ Lead Time ผู้จำหน่าย
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-2 hidden md:block">
            <p className="text-xs text-muted-foreground">เลือกแล้ว</p>
            <p className="text-sm font-bold text-indigo-700">{selectedIds.size} รายการ</p>
          </div>
          <Button
            onClick={handleCreatePRs}
            disabled={selectedIds.size === 0 || isPending}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            สร้าง {selectedIds.size} ใบขอซื้อ (Draft PR)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/50">
              <TableRow>
                <TableHead className="w-10 px-4">
                  <Checkbox
                    checked={selectedIds.size === suggestions.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead>สถานะ / เหตุผล</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead className="text-right">แนะนำสั่งซื้อ</TableHead>
                <TableHead className="hidden lg:table-cell">ผู้จำหน่ายแนะนำ</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((item) => (
                <TableRow key={item.productId} className="hover:bg-indigo-50/30 transition-colors">
                  <TableCell className="px-4">
                    <Checkbox
                      checked={selectedIds.has(item.productId)}
                      onCheckedChange={() => toggleSelect(item.productId)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{item.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {getUrgencyBadge(item.urgency)}
                      <span className="text-xs text-slate-500 italic max-w-[200px] leading-tight">
                        {item.reason}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex flex-col items-end">
                      <span className={item.currentStock <= 0 ? "text-red-600" : ""}>{item.currentStock} ชิ้น</span>
                      {item.daysRemaining !== null ? (
                        <span className="text-[10px] text-muted-foreground italic">ขายได้อีก ~{item.daysRemaining} วัน</span>
                      ) : (
                        item.avgDailySales > 0 ? (
                          <span className="text-[10px] text-muted-foreground italic">&lt; 1 วัน</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">ไม่มีความต้องการ</span>
                        )
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <div className="text-indigo-700 font-bold flex items-center gap-1">
                        {item.suggestedUnits}
                        <span className="text-[10px] font-normal text-slate-400">ชิ้น</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ({item.suggestedCtn} {item.packSize > 1 ? `CTN x${item.packSize}` : 'ชิ้น'})
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <Truck className="h-3 w-3 text-slate-400" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{item.vendorName}</span>
                        <span className="text-[10px] text-slate-400">Lead time: {item.reorderThresholdDays - 3} วัน</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-3">
                          <h4 className="font-bold border-b pb-1">รายละเอียดการคำนวณ</h4>
                          <div className="grid grid-cols-2 text-xs gap-y-2">
                            <span className="text-muted-foreground">อัตราการขายเฉลี่ย:</span>
                            <span className="text-right font-medium text-emerald-600">{item.avgDailySales.toFixed(2)} ชิ้น/วัน</span>

                            <span className="text-muted-foreground">คงเหลือปัจจุบัน:</span>
                            <span className="text-right font-medium">{item.currentStock} ชิ้น</span>

                            <span className="text-muted-foreground">เป้าหมายสำรอง:</span>
                            <span className="text-right font-medium">30 วัน</span>

                            <span className="text-muted-foreground">รวมที่ต้องการ (ชิ้น):</span>
                            <span className="text-right font-bold text-indigo-600">{item.suggestedUnits}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded text-[10px] text-slate-500 border border-slate-100">
                            * ปัดเศษขึ้นตามจำนวนบรรจุภัณฑ์ (Pack Size: {item.packSize}) เพื่อความสะดวกในการสั่งซื้อจริง
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
