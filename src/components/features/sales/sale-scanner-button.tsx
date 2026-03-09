'use client';

/**
 * Sale Scanner Button — Context-Aware AI Autofill
 *
 * AI อ่านภาพ → ตีความบริบท → autofill เฉพาะส่วนที่มั่นใจ:
 *   - แชทลูกค้า  → autofill ชื่อ/เบอร์/ที่อยู่ลูกค้า (ไม่แตะรายการสินค้า)
 *   - สลิปโอนเงิน → autofill วันที่/เวลา/ยอดชำระ (ยืนยันการขาย)
 *   - ใบแจ้งหนี้  → autofill ลูกค้า + รายการ (draft ให้ user ยืนยัน)
 *   - Order Shopee → autofill ลูกค้า + ที่อยู่ + รายการ
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Receipt,
  FileText,
  ShoppingBag,
  User,
  MapPin,
  Phone,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { compressImageForOCR } from '@/lib/ocr/compress';

// ── Scan phases ──
const SCAN_PHASES = [
  'กำลังวิเคราะห์ภาพ...',
  'กำลังตีความบริบท...',
  'กำลังค้นหาข้อมูลลูกค้า...',
  'กำลังอ่านที่อยู่...',
  'กำลังตรวจสอบข้อมูล...',
];

// ── Source type display ──
const SOURCE_TYPE_INFO: Record<string, {
  icon: React.ElementType;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  payment_slip:     { icon: Receipt,       label: 'สลิปโอนเงิน',     color: 'text-blue-600',   bgColor: 'bg-blue-50 dark:bg-blue-950/20',   description: 'AI จับวันที่/เวลา/ยอดชำระ' },
  chat_screenshot:  { icon: MessageSquare, label: 'แชทลูกค้า',       color: 'text-green-600',  bgColor: 'bg-green-50 dark:bg-green-950/20', description: 'AI อ่านที่อยู่/ชื่อ/เบอร์ลูกค้า' },
  sale_invoice:     { icon: FileText,      label: 'ใบแจ้งหนี้',      color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/20', description: 'AI อ่านรายการ + ข้อมูลลูกค้า' },
  order_screenshot: { icon: ShoppingBag,   label: 'Order Online',    color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20', description: 'AI อ่าน order + ที่อยู่จัดส่ง' },
  quotation:        { icon: FileText,      label: 'ใบเสนอราคา',      color: 'text-gray-600',   bgColor: 'bg-gray-50 dark:bg-gray-950/20',   description: 'AI อ่านรายการสินค้าและราคา' },
};

export interface SaleScanResult {
  sourceType: string;
  platform?: string | null;
  documentNumber?: string | null;
  senderName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  date?: string | null;
  time?: string | null;
  paymentMethod?: string | null;
  items: Array<{
    name: string;
    sku?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  total?: number;
  discount?: number;
  notes?: string | null;
  confidence: number;
}

interface SaleScannerButtonProps {
  onScanResult: (result: SaleScanResult) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function SaleScannerButton({
  onScanResult,
  disabled,
  variant = 'outline',
  size = 'default',
  className,
}: SaleScannerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState<'upload' | 'scanning' | 'result' | 'error'>('upload');
  const [scanPhase, setScanPhase] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [scanResult, setScanResult] = useState<SaleScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleScan = async (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setStage('scanning');
    startScanPhase();

    try {
      const compressed = await compressImageForOCR(file, { maxDimension: 1600, quality: 0.85 });

      const response = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          documentType: 'sale',
        }),
      });

      const data = await response.json();
      stopScanPhase();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'ไม่สามารถอ่านเอกสารได้');
      }

      const raw = data.data;

      const result: SaleScanResult = {
        sourceType: raw.sourceType || 'sale_invoice',
        platform: raw.platform || null,
        documentNumber: raw.documentNumber || null,
        senderName: raw.senderName || null,
        customerName: raw.customerName || raw.senderName || null,
        customerPhone: raw.customerPhone || null,
        customerAddress: raw.customerAddress || null,
        date: raw.date || null,
        time: raw.time || null,
        paymentMethod: normalizePaymentMethod(raw.paymentMethod),
        items: (raw.items || []).map((item: any) => ({
          name: item.name || '',
          sku: item.sku || null,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
        })).filter((item: any) => item.name),
        total: Number(raw.total) || 0,
        discount: Number(raw.discount) || 0,
        notes: raw.notes || null,
        confidence: data.confidence || 80,
      };

      setScanResult(result);
      setStage('result');
    } catch (err: any) {
      stopScanPhase();
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการสแกน');
      setStage('error');
    }
  };

  const normalizePaymentMethod = (raw?: string | null): string | null => {
    if (!raw) return null;
    const u = raw.toUpperCase();
    if (u.includes('CASH') || u.includes('เงินสด')) return 'CASH';
    if (u.includes('TRANSFER') || u.includes('โอน') || u.includes('BANK')) return 'BANK_TRANSFER';
    if (u.includes('PROMPTPAY') || u.includes('พร้อมเพย์')) return 'PROMPTPAY';
    if (u.includes('QR')) return 'QR_CODE';
    if (u.includes('CARD') || u.includes('บัตร')) return 'CREDIT_CARD';
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await handleScan(file);
  };

  const handleOpen = () => {
    setStage('upload');
    setPreviewUrl('');
    setScanResult(null);
    setErrorMsg('');
    setIsOpen(true);
  };

  const handleClose = () => {
    stopScanPhase();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setIsOpen(false);
  };

  const handleReset = () => {
    stopScanPhase();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setScanResult(null);
    setErrorMsg('');
    setStage('upload');
  };

  const handleConfirm = () => {
    if (!scanResult) return;
    onScanResult(scanResult);

    // Context-aware toast message
    const msgs: Record<string, string> = {
      payment_slip:     `✅ อัปเดตวันที่/เวลาชำระแล้ว (${scanResult.time || scanResult.date || ''})`,
      chat_screenshot:  `✅ autofill ข้อมูลลูกค้าแล้ว${scanResult.customerName ? ` — ${scanResult.customerName}` : ''}`,
      sale_invoice:     `✅ AI อ่าน ${scanResult.items.length} รายการ (draft — กรุณาตรวจสอบ)`,
      order_screenshot: `✅ autofill ข้อมูล Order แล้ว`,
    };
    toast.success(msgs[scanResult.sourceType] || '✅ นำเข้าข้อมูลสำเร็จ');
    handleClose();
  };

  const sourceInfo = scanResult ? SOURCE_TYPE_INFO[scanResult.sourceType] : null;
  const SourceIcon = sourceInfo?.icon || FileText;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleOpen}
        disabled={disabled}
      >
        <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
        AI สแกน
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI สแกนข้อมูลการขาย
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* ── Upload ── */}
            {stage === 'upload' && (
              <div className="space-y-3">
                {/* Guide */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(SOURCE_TYPE_INFO).slice(0, 4).map(([key, info]) => {
                    const Icon = info.icon;
                    return (
                      <div key={key} className={`flex items-center gap-1.5 rounded-lg p-2 ${info.bgColor}`}>
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${info.color}`} />
                        <div>
                          <p className={`font-medium text-xs ${info.color}`}>{info.label}</p>
                          <p className="text-muted-foreground text-[10px]">{info.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/30 rounded-xl p-10 cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-all group"
                >
                  <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Camera className="h-7 w-7 text-purple-600" />
                  </div>
                  <p className="font-semibold text-sm">ถ่ายรูปหรืออัพโหลด</p>
                  <p className="text-xs text-muted-foreground mt-1">สลิป • แชทลูกค้า • ใบแจ้งหนี้ • Order</p>
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

            {/* ── Scanning ── */}
            {stage === 'scanning' && (
              <div className="space-y-4">
                {previewUrl && (
                  <div className="relative rounded-lg overflow-hidden max-h-48">
                    <img src={previewUrl} alt="Preview" className="w-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Loader2 className="h-9 w-9 animate-spin mx-auto mb-2" />
                        <p className="text-sm font-medium">{SCAN_PHASES[scanPhase]}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Result ── */}
            {stage === 'result' && scanResult && sourceInfo && (
              <div className="space-y-4">
                {/* Preview */}
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-36 object-cover" />
                )}

                {/* Source type badge */}
                <div className={`flex items-center gap-2 rounded-lg p-2.5 ${sourceInfo.bgColor}`}>
                  <SourceIcon className={`h-4 w-4 ${sourceInfo.color}`} />
                  <div>
                    <p className={`text-sm font-semibold ${sourceInfo.color}`}>{sourceInfo.label}</p>
                    <p className="text-xs text-muted-foreground">{sourceInfo.description}</p>
                  </div>
                  {scanResult.platform && (
                    <Badge variant="outline" className="ml-auto text-xs">{scanResult.platform}</Badge>
                  )}
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {scanResult.confidence}%
                  </Badge>
                </div>

                {/* ── Payment slip: show date/time ── */}
                {scanResult.sourceType === 'payment_slip' && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="text-xs font-medium text-muted-foreground">ข้อมูลที่จะ autofill:</p>
                    {scanResult.senderName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{scanResult.senderName}</span>
                      </div>
                    )}
                    {scanResult.date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{scanResult.date}{scanResult.time ? ` เวลา ${scanResult.time}` : ''}</span>
                      </div>
                    )}
                    {(scanResult.total ?? 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-semibold">฿{(scanResult.total ?? 0).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Chat/Invoice/Order: show customer info ── */}
                {scanResult.sourceType !== 'payment_slip' && (
                  scanResult.customerName || scanResult.customerPhone || scanResult.customerAddress
                ) && (
                  <div className="space-y-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">
                      ✨ ข้อมูลลูกค้าที่จะ autofill:
                    </p>
                    {scanResult.customerName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-green-600" />
                        <span className="font-medium">{scanResult.customerName}</span>
                      </div>
                    )}
                    {scanResult.customerPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-green-600" />
                        <span>{scanResult.customerPhone}</span>
                      </div>
                    )}
                    {scanResult.customerAddress && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-xs leading-relaxed">{scanResult.customerAddress}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Items (draft) ── */}
                {scanResult.items.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        รายการสินค้า (draft — กรุณาตรวจสอบ):
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {scanResult.items.length} รายการ
                      </Badge>
                    </div>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {scanResult.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/50 border">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            {item.sku && <p className="text-muted-foreground">SKU: {item.sku}</p>}
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <p className="text-muted-foreground">x{item.quantity}</p>
                            <p className="font-medium">฿{item.total.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {(scanResult.total ?? 0) > 0 && (
                      <div className="flex justify-between font-semibold text-sm pt-1 border-t">
                        <span>ยอดรวม</span>
                        <span>฿{(scanResult.total ?? 0).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {scanResult.notes && (
                  <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg p-2">
                    📝 {scanResult.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleReset}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    สแกนใหม่
                  </Button>
                  <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleConfirm}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    นำเข้าข้อมูล
                  </Button>
                </div>
              </div>
            )}

            {/* ── Error ── */}
            {stage === 'error' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <AlertCircle className="h-12 w-12 text-destructive mb-3" />
                  <p className="font-medium">ไม่สามารถอ่านเอกสารได้</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={handleReset}>
                  ลองใหม่อีกครั้ง
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
