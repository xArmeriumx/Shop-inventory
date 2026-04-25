'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShipmentStatusBadge } from './shipment-status-badge';
import { matchParcelsToSales, createShipment } from '@/actions/sales/shipments.actions';
import type { OcrParcel, ParcelMatch } from '@/actions/sales/shipments.actions';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  Upload,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/formatters';

type ScanStep = 'upload' | 'scanning' | 'review' | 'creating';

interface SaleOption {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  totalAmount: number;
}

interface ShipmentScannerProps {
  availableSales: SaleOption[];
}

export function ShipmentScanner({ availableSales }: ShipmentScannerProps) {
  const router = useRouter();
  const [step, setStep] = useState<ScanStep>('upload');
  const [isPending, startTransition] = useTransition();
  const [matches, setMatches] = useState<ParcelMatch[]>([]);
  const [manualSaleIds, setManualSaleIds] = useState<Record<number, string>>({});
  const [addresses, setAddresses] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setStep('scanning');

      try {
        // Call OCR API
        const response = await fetch('/api/ocr/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
            documentType: 'shipment',
          }),
        });

        const result = await response.json();

        if (!result.success || !result.data?.parcels) {
          toast.error('ไม่สามารถอ่านใบเสร็จได้ กรุณาลองใหม่');
          setStep('upload');
          return;
        }

        // Smart match
        const parcels: OcrParcel[] = result.data.parcels.map((p: any) => ({
          trackingNumber: p.trackingNumber || '',
          shippingProvider: p.shippingProvider || '',
          recipientName: p.recipientName || '',
          recipientPhone: p.recipientPhone || null,
          province: p.province || null,
          shippingCost: p.shippingCost || null,
          weight: p.weight || null,
          size: p.size || null,
        }));

        const matchResult = await matchParcelsToSales(parcels);
        if (matchResult.success) {
          setMatches(matchResult.data);
          setStep('review');
          toast.success(`พบ ${parcels.length} พัสดุ, จับคู่ได้ ${matchResult.data.filter((m: any) => m.sale).length} รายการ`);
        } else {
          console.error('Failed to match parcels:', matchResult.message);
          toast.error(matchResult.message);
          setStep('upload');
        }
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการสแกน');
        setStep('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAll = () => {
    startTransition(async () => {
      setStep('creating');
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const saleId = match.sale?.id || manualSaleIds[i];
        const address = addresses[i] || match.parcel.province || '';

        if (!saleId || !address) {
          errorCount++;
          continue;
        }

        const result = await createShipment({
          saleId,
          recipientName: match.parcel.recipientName,
          recipientPhone: match.parcel.recipientPhone,
          shippingAddress: address,
          trackingNumber: match.parcel.trackingNumber,
          shippingProvider: match.parcel.shippingProvider,
          shippingCost: match.parcel.shippingCost,
        });

        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`สร้าง ${successCount} รายการจัดส่งสำเร็จ`);
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} รายการสร้างไม่สำเร็จ`, {
            description: 'กรุณาตรวจสอบความถูกต้องของข้อมูลสแกนอีกครั้ง'
        });
      }

      // Safe navigation pattern
      setTimeout(() => {
        router.push('/shipments');
        router.refresh();
      }, 100);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/shipments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">สแกนใบเสร็จขนส่ง</h1>
          <p className="text-sm text-muted-foreground">
            อัพโหลดรูปใบเสร็จเพื่อสร้างรายการจัดส่งอัตโนมัติ
          </p>
        </div>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardContent className="pt-6">
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">อัพโหลดรูปใบเสร็จ</p>
              <p className="text-sm text-muted-foreground mt-1">
                รองรับ Dee Express, Kerry, Flash, J&T, ไปรษณีย์ไทย
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, HEIC — สูงสุด 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning Step */}
      {step === 'scanning' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">กำลังอ่านใบเสร็จ...</p>
            <p className="text-sm text-muted-foreground">
              AI กำลังประมวลผล อาจใช้เวลา 5-15 วินาที
            </p>
          </CardContent>
        </Card>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ตรวจสอบข้อมูล</CardTitle>
              <CardDescription>
                ตรวจสอบข้อมูลที่ AI อ่านได้ และเลือกรายการขายที่ต้องการเชื่อมต่อ
              </CardDescription>
            </CardHeader>
          </Card>

          {matches.map((match, index) => (
            <Card key={index} className={match.confidence === 'high' ? 'border-green-200' : 'border-yellow-200'}>
              <CardContent className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Parcel Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {match.confidence === 'high' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      <span className="font-mono font-bold">{match.parcel.trackingNumber}</span>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">ผู้รับ:</span> {match.parcel.recipientName}
                      {match.parcel.recipientPhone && ` (${match.parcel.recipientPhone})`}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">ขนส่ง:</span> {match.parcel.shippingProvider}
                      {match.parcel.shippingCost && ` — ${formatCurrency(match.parcel.shippingCost)}`}
                    </p>
                  </div>

                  {/* Sale Match / Manual Select */}
                  <div className="space-y-2">
                    {match.sale ? (
                      <div className="p-3 rounded-md bg-green-50 border border-green-200">
                        <p className="text-sm font-medium text-green-700">
                          ✓ จับคู่ได้: {match.sale.invoiceNumber}
                        </p>
                        <p className="text-xs text-green-600">
                          {match.sale.customer?.name || match.sale.customerName} — {formatCurrency(match.sale.totalAmount)}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm text-yellow-600 font-medium">⚠ ไม่พบรายการขายที่ตรงกัน</p>
                        <Select
                          value={manualSaleIds[index] || ''}
                          onValueChange={(v) => setManualSaleIds((prev) => ({ ...prev, [index]: v }))}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="เลือกรายการขาย..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSales.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.invoiceNumber} — {s.customerName || 'ลูกค้าทั่วไป'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Address input */}
                    <Input
                      placeholder="ที่อยู่จัดส่ง *"
                      value={addresses[index] || (match.parcel.province || '')}
                      onChange={(e) => setAddresses((prev) => ({ ...prev, [index]: e.target.value }))}
                      className="text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setStep('upload'); setMatches([]); }}>
              สแกนใหม่
            </Button>
            <Button onClick={handleCreateAll} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4 mr-2" />
              )}
              สร้าง {matches.filter((m, i) => m.sale || manualSaleIds[i]).length} รายการ
            </Button>
          </div>
        </div>
      )}

      {/* Creating Step */}
      {step === 'creating' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">กำลังสร้างรายการจัดส่ง...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
