'use client';

import { useState, useEffect } from 'react';
import { QrCode, Smartphone, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PromptPayQRProps {
  promptPayId: string;
  amount: number;
}

/**
 * PromptPay QR Code Generator
 * สร้าง QR Code PromptPay ตามมาตรฐาน EMVCo สำหรับรับเงินโอน
 */
export function PromptPayQR({ promptPayId, amount }: PromptPayQRProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function generateQR() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic import to keep client bundle smaller
        const generatePayload = (await import('promptpay-qr')).default;
        const QRCode = (await import('qrcode')).default;

        // Strip formatting: remove dashes, spaces
        const cleanId = promptPayId.replace(/[-\s]/g, '');

        // Generate EMVCo payload
        const payload = generatePayload(cleanId, { amount });

        // Generate QR as Data URL (PNG)
        const dataUrl = await QRCode.toDataURL(payload, {
          width: 280,
          margin: 2,
          color: {
            dark: '#1a1a2e',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });

        if (!cancelled) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error('QR generation error:', err);
        if (!cancelled) {
          setError('ไม่สามารถสร้าง QR Code ได้');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    generateQR();
    return () => { cancelled = true; };
  }, [promptPayId, amount]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-[200px] h-[200px] rounded-2xl bg-muted animate-pulse flex items-center justify-center">
          <QrCode className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground">กำลังสร้าง QR Code...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-6">
        <div className="inline-flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
          <QrCode className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR Code with decorative border */}
      <div className="relative">
        {/* Gradient border effect */}
        <div className="absolute -inset-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 blur-sm" />
        <div className="relative bg-white rounded-2xl p-3 shadow-lg">
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="PromptPay QR Code"
              width={280}
              height={280}
              className="block"
            />
          )}
        </div>
      </div>

      {/* Amount badge */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-5 py-2.5 rounded-full shadow-md">
        <span className="text-sm font-medium opacity-80">ยอดชำระ</span>
        <span className="text-lg font-bold ml-2">
          {formatCurrency(amount.toString())}
        </span>
      </div>

      {/* Instructions */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          <span>สแกน QR ผ่านแอปธนาคาร</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>PromptPay: {promptPayId}</span>
        </div>
      </div>
    </div>
  );
}
