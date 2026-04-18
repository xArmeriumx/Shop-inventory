'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface POSHeaderProps {
  shopName?: string;
  userName?: string;
}

/**
 * POS Header - Minimal header with clock and navigation
 */
export function POSHeader({ shopName = 'ร้านค้า', userName = 'User' }: POSHeaderProps) {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
      {/* Left: Back button + Shop name */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1" />
            กลับ
          </Link>
        </Button>
        <div className="h-6 w-px bg-border" />
        <span className="font-semibold text-lg">{shopName}</span>
      </div>

      {/* Right: Clock + User */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-mono text-lg tabular-nums">{currentTime}</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium hidden sm:inline">{userName}</span>
        </div>
      </div>
    </header>
  );
}
