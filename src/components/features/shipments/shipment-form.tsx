'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SafeInput } from '@/components/ui/safe-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, ArrowLeft } from 'lucide-react';
import { createShipment } from '@/actions/shipments';
import { toast } from 'sonner';
import type { Customer } from '@prisma/client';
import Link from 'next/link';

interface SaleOption {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  totalAmount: number;
  date: Date | string;
  customer: Pick<Customer, 'id' | 'name' | 'phone'> | null;
}

interface ShipmentFormProps {
  sales: SaleOption[];
  preSelectedSaleId?: string;
}

export function ShipmentForm({ sales, preSelectedSaleId }: ShipmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSaleId, setSelectedSaleId] = useState(preSelectedSaleId || '');

  const selectedSale = sales.find((s) => s.id === selectedSaleId);

  // Auto-fill from customer when sale is selected
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const handleSaleChange = (saleId: string) => {
    setSelectedSaleId(saleId);
    const sale = sales.find((s) => s.id === saleId);
    if (sale) {
      setRecipientName(sale.customer?.name || sale.customerName || '');
      setRecipientPhone(sale.customer?.phone || '');
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createShipment({
        saleId: selectedSaleId,
        recipientName: formData.get('recipientName') as string,
        recipientPhone: (formData.get('recipientPhone') as string) || null,
        shippingAddress: formData.get('shippingAddress') as string,
        trackingNumber: (formData.get('trackingNumber') as string) || null,
        shippingProvider: (formData.get('shippingProvider') as string) || null,
        shippingCost: formData.get('shippingCost')
          ? Number(formData.get('shippingCost'))
          : null,
        notes: (formData.get('notes') as string) || null,
      });

      if (result.success) {
        toast.success(result.message);
        router.push('/shipments');
        router.refresh();
      } else {
        toast.error(result.message || 'เกิดข้อผิดพลาด');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sale Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">เลือกรายการขาย</CardTitle>
          <CardDescription>เลือกรายการขายที่ต้องการจัดส่ง</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSaleId} onValueChange={handleSaleChange}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกรายการขาย..." />
            </SelectTrigger>
            <SelectContent>
              {sales.map((sale) => (
                <SelectItem key={sale.id} value={sale.id}>
                  {sale.invoiceNumber} — {sale.customer?.name || sale.customerName || 'ลูกค้าทั่วไป'} (
                  {Number(sale.totalAmount).toLocaleString()} ฿)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sales.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              ไม่มีรายการขายที่รอจัดส่ง
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลผู้รับ</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipientName">ชื่อผู้รับ *</Label>
            <Input
              id="recipientName"
              name="recipientName"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="ชื่อ-นามสกุลผู้รับ"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipientPhone">เบอร์โทร</Label>
            <SafeInput
              id="recipientPhone"
              name="recipientPhone"
              numericOnly
              maxLength={10}
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="เช่น 0812345678"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="shippingAddress">ที่อยู่จัดส่ง *</Label>
            <Textarea
              id="shippingAddress"
              name="shippingAddress"
              required
              rows={3}
              placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tracking & Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ข้อมูลขนส่ง</CardTitle>
          <CardDescription>ถ้ากรอก Tracking หมายเลข สถานะจะเป็น &quot;ส่งแล้ว&quot; อัตโนมัติ</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="trackingNumber">หมายเลข Tracking</Label>
            <Input
              id="trackingNumber"
              name="trackingNumber"
              placeholder="TH01488BG2TN0B"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shippingProvider">บริษัทขนส่ง</Label>
            <Select name="shippingProvider">
              <SelectTrigger>
                <SelectValue placeholder="เลือกบริษัทขนส่ง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Flash Express">Flash Express</SelectItem>
                <SelectItem value="Kerry Express">Kerry Express</SelectItem>
                <SelectItem value="J&T Express">J&T Express</SelectItem>
                <SelectItem value="Thailand Post">ไปรษณีย์ไทย</SelectItem>
                <SelectItem value="DHL">DHL</SelectItem>
                <SelectItem value="Ninja Van">Ninja Van</SelectItem>
                <SelectItem value="Best Express">Best Express</SelectItem>
                <SelectItem value="Dee Express">Dee Express</SelectItem>
                <SelectItem value="other">อื่นๆ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shippingCost">ค่าส่ง (บาท)</Label>
            <Input
              id="shippingCost"
              name="shippingCost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">หมายเหตุ</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="notes"
            rows={2}
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href="/shipments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Link>
        </Button>
        <Button type="submit" disabled={isPending || !selectedSaleId}>
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          สร้างรายการจัดส่ง
        </Button>
      </div>
    </form>
  );
}
