'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * POS Error Page
 * 
 * แสดงเมื่อเกิด error ใน POS module
 * ออกแบบให้ recovery เร็วที่สุด
 */
export default function POSError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('POS error:', error);
  }, [error]);

  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-sm">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-2">ระบบ POS ขัดข้อง</h1>
        
        {/* Description */}
        <p className="text-muted-foreground mb-6">
          กรุณาลองใหม่อีกครั้ง หากยังมีปัญหา ให้กลับไปหน้าหลัก
        </p>

        {/* Error message (dev only) */}
        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg mb-6 font-mono text-left break-all">
            {error.message}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button onClick={reset} className="w-full" size="lg">
            <RefreshCw className="h-5 w-5 mr-2" />
            ลองใหม่
          </Button>
          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5 mr-2" />
              กลับหน้าหลัก
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
