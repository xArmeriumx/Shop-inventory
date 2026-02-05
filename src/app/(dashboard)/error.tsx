'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * Dashboard Error Page
 * 
 * แสดงเมื่อเกิด error ใน dashboard routes
 * ยังคง sidebar/layout ไว้ (ถ้าเป็นไปได้)
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold mb-2">เกิดข้อผิดพลาด</h1>
        
        {/* Description */}
        <p className="text-muted-foreground mb-4">
          ขออภัย เกิดข้อผิดพลาดในการโหลดหน้านี้
        </p>

        {/* Error message (dev only) */}
        {process.env.NODE_ENV === 'development' && error?.message && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4 font-mono text-left break-all">
            {error.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-center">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            ลองใหม่
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              กลับหน้าหลัก
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
