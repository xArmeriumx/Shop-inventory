'use client';

import { useState, useEffect } from 'react';
import { getIncompleteRequests, quickAssignSupplier } from '@/actions/inventory/ops.actions';
import { getSuppliersForSelect } from '@/actions/purchases/suppliers.actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Truck, UserCircle, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import Link from 'next/link';

export function ProcurementGapTool() {
  const [data, setData] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetSupplierId, setTargetSupplierId] = useState<string>('');
  const [processing, setProcessing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requests, supplierList] = await Promise.all([
        getIncompleteRequests(),
        getSuppliersForSelect()
      ]);
      setData(requests.items);
      setSuppliers(supplierList);
    } catch (error) {
      console.error('Failed to load procurement gaps', error);
      toast.error('ไม่สามารถโหลดข้อมูลใบขอซื้อได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(data.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBatchAssign = async () => {
    if (!targetSupplierId) {
      toast.error('กรุณาเลือกผู้จำหน่าย');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('กรุณาเลือกใบขอซื้ออย่างน้อย 1 รายการ');
      return;
    }

    setProcessing(true);
    try {
      const result = await quickAssignSupplier(selectedIds, targetSupplierId);
      if (result.success) {
        toast.success(result.message);
        setSelectedIds([]);
        setTargetSupplierId('');
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการมอบหมายผู้ขาย');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">จัดการใบขอซื้อที่ยังไม่มีผู้ขาย (Procurement Gaps)</h3>
          <p className="text-sm text-muted-foreground">ใบขอซื้อ (PR) เหล่านี้ยังไม่ระบุผู้ขาย จึงยังไม่สามารถเปลี่ยนเป็นใบสั่งซื้อ (PO) ได้</p>
        </div>
      </div>

      {data.length > 0 && (
        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">เลือก {selectedIds.length} รายการ</span>
            <span className="text-sm text-muted-foreground">เพื่อมอบหมายผู้ขาย:</span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[300px] max-w-md">
            <Select value={targetSupplierId} onValueChange={setTargetSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้จำหน่าย..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
                onClick={handleBatchAssign} 
                disabled={processing || !targetSupplierId || selectedIds.length === 0}
                className="whitespace-nowrap"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
              มอบหมายผู้ขาย
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 text-left w-10">
                <Checkbox 
                  checked={selectedIds.length === data.length && data.length > 0} 
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </th>
              <th className="p-3 text-left font-medium">เลขขที่เอกสาร</th>
              <th className="p-3 text-left font-medium">วันที่สร้าง</th>
              <th className="p-3 text-left font-medium">รายการสินค้า</th>
              <th className="p-3 text-right font-medium">ยอดรวม</th>
              <th className="p-3 text-center font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                        <ShoppingCart className="h-12 w-12 opacity-20" />
                        ไม่มีใบขอซื้อที่ค้างข้อมูลผู้ขาย
                    </div>
                </td>
              </tr>
            ) : (
              data.map((pr) => (
                <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-3">
                    <Checkbox 
                        checked={selectedIds.includes(pr.id)} 
                        onCheckedChange={(checked) => handleSelectOne(pr.id, !!checked)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{pr.purchaseNumber}</div>
                    <Badge variant="outline" className="text-[10px] h-4 mt-1">DRAFT PR</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(pr.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="p-3">
                    <div className="text-xs space-y-1">
                      {pr.items.slice(0, 2).map((item: any) => (
                        <div key={item.id} className="flex gap-1 items-center">
                          <Package className="h-3 w-3 opacity-60" />
                          <span className="truncate max-w-[150px]">{item.product.name}</span>
                          <span className="text-muted-foreground">x{item.quantity}</span>
                        </div>
                      ))}
                      {pr.items.length > 2 && (
                        <div className="text-[10px] text-blue-600">และอีก {pr.items.length - 2} รายการ...</div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(pr.totalCost)}
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/purchases/${pr.id}`}>เปิดดู</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
