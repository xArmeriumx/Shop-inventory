'use client';

/**
 * Shipment Scanner Dialog — Universal Tracking Extractor
 *
 * รองรับทุกประเภทภาพ:
 *   ✅ ใบเสร็จขนส่ง (Dee Express, Kerry, Flash, J&T)
 *   ✅ Screenshot แชทลูกค้า (LINE, Facebook, WhatsApp)
 *   ✅ Platform UI (Shopee, Lazada, TikTok Shop)
 *   ✅ ใบปะหน้าพัสดุ (Shipping Label)
 *   ✅ App ติดตามพัสดุ
 *
 * UX Flow:
 *   Upload/Camera → AI สแกน → Review parcels → Match กับ sales → บันทึก
 */

import { useState, useRef, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  MessageSquare,
  Monitor,
  FileText,
  ChevronRight,
  RotateCcw,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { compressImageForOCR } from '@/lib/ocr/compress';
import { matchParcelsToSales, createShipment } from '@/actions/shipments';
import type { OcrParcel, ParcelMatch } from '@/actions/shipments';

// ── Scan phases animation ──
const SCAN_PHASES = [
  'กำลังวิเคราะห์ภาพ...',
  'กำลังค้นหาเลขพัสดุ...',
  'กำลังระบุบริษัทขนส่ง...',
  'กำลังอ่านข้อมูลผู้รับ...',
  'กำลังจับคู่กับออเดอร์...',
];

// ── Source type icons/labels ──
const SOURCE_TYPE_INFO: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  courier_receipt: { icon: FileText,     label: 'ใบเสร็จขนส่ง',       color: 'text-blue-600' },
  chat_screenshot: { icon: MessageSquare, label: 'Screenshot แชท',    color: 'text-green-600' },
  platform_ui:    { icon: Monitor,       label: 'Platform (Shopee/Lazada)', color: 'text-orange-600' },
  shipping_label: { icon: Package,       label: 'ใบปะหน้าพัสดุ',     color: 'text-purple-600' },
  tracking_app:   { icon: Truck,         label: 'App ติดตามพัสดุ',  color: 'text-teal-600' },
};

interface SaleOption {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  totalAmount: number;
}

interface ShipmentScannerDialogProps {
  /** Open/close state controlled by parent */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Available sales to match against */
  availableSales: SaleOption[];
  /** Called after shipments are successfully created */
  onSuccess?: () => void;
}

type Step = 'upload' | 'scanning' | 'review' | 'creating' | 'done';

export function ShipmentScannerDialog({
  open,
  onOpenChange,
  availableSales,
  onSuccess,
}: ShipmentScannerDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [scanPhase, setScanPhase] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [sourceType, setSourceType] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [matches, setMatches] = useState<ParcelMatch[]>([]);
  const [manualSaleIds, setManualSaleIds] = useState<Record<number, string>>({});
  const [selectedAddresses, setSelectedAddresses] = useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [createdCount, setCreatedCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, startTransition] = useTransition();

  // ── Phase animation ──
  const startScanPhase = () => {
    setScanPhase(0);
    scanIntervalRef.current = setInterval(
      () => setScanPhase((p) => (p + 1) % SCAN_PHASES.length),
      1600,
    );
  };

  const stopScanPhase = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  // ── Reset ──
  const handleReset = () => {
    stopScanPhase();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setStep('upload');
    setPreviewUrl('');
    setSourceType(null);
    setPlatform(null);
    setMatches([]);
    setManualSaleIds({});
    setSelectedAddresses({});
    setErrorMsg('');
    setCreatedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  // ── Core scan ──
  const handleScan = async (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStep('scanning');
    startScanPhase();

    try {
      const compressed = await compressImageForOCR(file, { maxDimension: 1600, quality: 0.85 });
      
      const response = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          documentType: 'shipment',
        }),
      });

      const result = await response.json();
      stopScanPhase();

      if (!result.success || !result.data?.parcels?.length) {
        setErrorMsg(result.error || 'ไม่พบเลขพัสดุในภาพนี้ กรุณาลองใหม่');
        setStep('review'); // Show empty review with option to retry
        return;
      }

      // Save source metadata
      setSourceType(result.data.sourceType || 'courier_receipt');
      setPlatform(result.data.platform || null);

      // Map to OcrParcel
      const parcels: OcrParcel[] = result.data.parcels.map((p: any) => ({
        trackingNumber: p.trackingNumber?.trim() || '',
        shippingProvider: p.shippingProvider || '',
        recipientName: p.recipientName || '',
        recipientPhone: p.recipientPhone || null,
        province: p.province || null,
        shippingCost: p.shippingCost || null,
        weight: p.weight || null,
        size: p.size || null,
      })).filter((p: OcrParcel) => p.trackingNumber.length >= 5);

      if (parcels.length === 0) {
        setErrorMsg('ไม่พบเลขพัสดุที่ถูกต้อง กรุณาลองใหม่');
        setStep('review');
        return;
      }

      // Auto-match with sales
      const matchResult = await matchParcelsToSales(parcels);
      setMatches(matchResult);
      setStep('review');

      const autoMatched = matchResult.filter((m) => m.sale).length;
      toast.success(`พบ ${parcels.length} พัสดุ — จับคู่อัตโนมัติ ${autoMatched} รายการ`);

    } catch (err: any) {
      stopScanPhase();
      console.error('[ShipmentScanner] Error:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสแกน');
      setStep('review');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await handleScan(file);
  };

  // ── Create shipments ──
  const handleCreateAll = () => {
    const toCreate = matches.filter((m, i) => {
      const saleId = m.sale?.id || manualSaleIds[i];
      return m.parcel.trackingNumber && saleId;
    });

    if (toCreate.length === 0) {
      toast.error('ไม่มีรายการที่พร้อมสร้าง (ต้องเลือก Sale ก่อน)');
      return;
    }

    setStep('creating');
    startTransition(async () => {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const saleId = match.sale?.id || manualSaleIds[i];
        if (!saleId || !match.parcel.trackingNumber) continue;

        try {
          const result = await createShipment({
            saleId,
            trackingNumber: match.parcel.trackingNumber,
            shippingProvider: match.parcel.shippingProvider || undefined,
            shippingCost: match.parcel.shippingCost || undefined,
            recipientName: (match.parcel.recipientName || match.sale?.customerName || 'ผู้รับ') as string,
            recipientPhone: match.parcel.recipientPhone || undefined,
            shippingAddress:
              selectedAddresses[i] ||
              match.parcel.province ||
              match.sale?.customerName ||
              'ไม่ระบุ',
          });

          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`[ShipmentScanner] Failed to create shipment ${i}:`, result.message);
          }
        } catch (err) {
          failCount++;
        }
      }

      setCreatedCount(successCount);
      setStep('done');

      if (successCount > 0) {
        toast.success(`สร้าง ${successCount} รายการจัดส่งสำเร็จ`);
        onSuccess?.();
      }
      if (failCount > 0) {
        toast.error(`สร้างไม่สำเร็จ ${failCount} รายการ`);
      }
    });
  };

  const sourceInfo = sourceType ? SOURCE_TYPE_INFO[sourceType] : null;
  const SourceIcon = sourceInfo?.icon || FileText;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI สแกนพัสดุ
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* ── Upload Step ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Source type guide */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(SOURCE_TYPE_INFO).map(([key, info]) => {
                  const Icon = info.icon;
                  return (
                    <div key={key} className="flex items-center gap-1.5 text-muted-foreground bg-muted/40 rounded-lg p-2">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${info.color}`} />
                      <span>{info.label}</span>
                    </div>
                  );
                })}
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-10 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all group"
              >
                <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Camera className="h-8 w-8 text-purple-600" />
                </div>
                <p className="font-semibold">ถ่ายรูปหรืออัพโหลด</p>
                <p className="text-sm text-muted-foreground mt-1">ใบเสร็จ • แชท • Shopee/Lazada UI</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleScan(file);
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                เลือกจากแกลเลอรี
              </Button>
            </div>
          )}

          {/* ── Scanning Step ── */}
          {step === 'scanning' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="relative rounded-lg overflow-hidden max-h-52">
                  <img src={previewUrl} alt="Preview" className="w-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="relative mb-3">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto" />
                        <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-yellow-400" />
                      </div>
                      <p className="font-semibold">{SCAN_PHASES[scanPhase]}</p>
                      <p className="text-xs text-white/70 mt-1">AI กำลังวิเคราะห์...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Review Step ── */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Source type badge */}
              {sourceInfo && (
                <div className="flex items-center gap-2">
                  <SourceIcon className={`h-4 w-4 ${sourceInfo.color}`} />
                  <span className="text-sm font-medium">{sourceInfo.label}</span>
                  {platform && (
                    <Badge variant="outline" className="text-xs">{platform}</Badge>
                  )}
                </div>
              )}

              {/* Error / No results */}
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              {/* Preview */}
              {previewUrl && (
                <img src={previewUrl} alt="Scanned" className="w-full rounded-lg max-h-36 object-cover" />
              )}

              {/* Parcels list */}
              {matches.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    พัสดุที่พบ ({matches.length} รายการ):
                  </p>
                  {matches.map((match, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      {/* Tracking + Provider */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-sm font-semibold">{match.parcel.trackingNumber}</p>
                          <p className="text-xs text-muted-foreground">{match.parcel.shippingProvider}</p>
                        </div>
                        {match.parcel.shippingCost != null && (
                          <Badge variant="secondary">฿{match.parcel.shippingCost}</Badge>
                        )}
                      </div>

                      {/* Recipient */}
                      {(match.parcel.recipientName || match.parcel.recipientPhone) && (
                        <div className="text-xs text-muted-foreground">
                          📍 {[match.parcel.recipientName, match.parcel.recipientPhone, match.parcel.province].filter(Boolean).join(' · ')}
                        </div>
                      )}

                      {/* Matched sale */}
                      {match.sale ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          จับคู่กับ {match.sale.invoiceNumber}
                          {match.sale.customerName && ` — ${match.sale.customerName}`}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs text-amber-600">⚠️ ไม่พบออเดอร์ — เลือกด้วยตนเอง:</p>
                          <select
                            className="w-full text-xs border rounded-md p-1.5 bg-background"
                            value={manualSaleIds[i] || ''}
                            onChange={(e) => setManualSaleIds((prev) => ({ ...prev, [i]: e.target.value }))}
                          >
                            <option value="">— เลือก Sale —</option>
                            {availableSales.map((sale) => (
                              <option key={sale.id} value={sale.id}>
                                {sale.invoiceNumber} {sale.customerName ? `— ${sale.customerName}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  สแกนใหม่
                </Button>
                {matches.length > 0 && (
                  <Button
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={handleCreateAll}
                    disabled={
                      matches.every((m, i) => !m.sale?.id && !manualSaleIds[i])
                    }
                  >
                    <ChevronRight className="h-4 w-4 mr-1" />
                    บันทึก {matches.filter((m, i) => m.sale?.id || manualSaleIds[i]).length} รายการ
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Creating Step ── */}
          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-purple-600 animate-spin" />
              </div>
              <p className="font-medium">กำลังบันทึกรายการจัดส่ง...</p>
            </div>
          )}

          {/* ── Done Step ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <p className="font-semibold text-lg">บันทึกสำเร็จ!</p>
              <p className="text-sm text-muted-foreground">สร้าง {createdCount} รายการจัดส่งแล้ว</p>
              <Button onClick={handleClose} className="w-full">
                ปิด
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
