'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { QrCode, Smartphone } from 'lucide-react';
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
          width: 260,
          margin: 2,
          color: {
            dark: '#000000',
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
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-[200px] h-[200px] rounded-xl bg-muted animate-pulse flex items-center justify-center">
          <QrCode className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground">กำลังสร้าง QR Code...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2.5 rounded-lg">
          <QrCode className="h-4 w-4" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* QR Code — clean, system-style card */}
      <div className="bg-white rounded-xl p-2.5 border shadow-sm">
        {qrDataUrl && (
          <Image
            src={qrDataUrl}
            alt="PromptPay QR Code"
            width={260}
            height={260}
            className="block rounded"
            unoptimized
          />
        )}
      </div>

      {/* Amount — uses system colors, no gradient */}
      <div className="bg-muted rounded-lg px-4 py-2 text-center">
        <span className="text-xs text-muted-foreground">ยอดชำระ </span>
        <span className="text-lg font-bold">
          {formatCurrency(amount.toString())}
        </span>
      </div>

      {/* Instructions */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Smartphone className="h-3.5 w-3.5" />
        <span>สแกน QR ผ่านแอปธนาคาร · PromptPay: {promptPayId}</span>
      </div>
    </div>
  );
}
