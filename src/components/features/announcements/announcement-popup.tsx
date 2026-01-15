'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Users, Shield, ShoppingCart, CheckCircle2 } from 'lucide-react';

// Configuration for the latest announcement
const CURRENT_ANNOUNCEMENT = {
  id: 'update-v2.0-rbac-pos', // Change this ID to force show to everyone again
  version: 'v2.0.0',
  date: '16 มกราคม 2026',
  title: '🎉 อัปเดตใหญ่! ระบบจัดการทีมและ POS ใหม่',
  description: 'ยกระดับการจัดการร้านค้าด้วยระบบสิทธิ์ (RBAC) และ POS เต็มรูปแบบ',
  features: [
    {
      icon: Users,
      title: 'ระบบจัดการทีม (Team Management)',
      description: 'เพิ่มพนักงานและกำหนดสิทธิ์การเข้าถึงได้ไม่จำกัด เชิญทีมงานเข้าร่วมร้านผ่านอีเมลได้ทันที',
    },
    {
      icon: Shield,
      title: 'จัดการสิทธิ์ (Roles & Permissions)',
      description: 'สร้างตำแหน่งงาน (Role) ได้ตามใจชอบ กำหนดสิทธิ์ละเอียดถึงระดับปุ่มกด (เช่น ให้ขายได้แต่ห้ามดูทุน)',
    },
    {
      icon: ShoppingCart,
      title: 'ระบบ POS ใหม่ (Point of Sale)',
      description: 'หน้าขายหน้าร้านแบบขยายเต็มจอ รองรับการยิงบาร์โค้ด และทำงานร่วมกับสิทธิ์การเข้าถึงแบบ Real-time',
    },
    {
      icon: CheckCircle2,
      title: 'ปรับปรุงระบบ',
      description: 'แก้ไข Card สรุปยอดขาย, เพิ่มระบบตรวจสอบสิทธิ์แบบ Real-time, และปรับปรุงหน้าตั้งค่าให้ใช้งานง่ายขึ้น',
    },
  ],
};

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // Logic for showing popup
      // 1. Check if user has seen this specific announcement ID
      const seenData = localStorage.getItem('announcement_seen');
      const now = Date.now();
      
      let shouldShow = false;

      if (!seenData) {
        shouldShow = true;
      } else {
        const { id, lastSeen } = JSON.parse(seenData);
        
        // If ID matches, check time (every 1 hour as requested)
        if (id === CURRENT_ANNOUNCEMENT.id) {
          const hoursSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60);
          if (hoursSinceLastSeen >= 1) { // Show again after 1 hour
            shouldShow = true;
          }
        } else {
          // If ID is new (different update), show immediately
          shouldShow = true;
        }
      }

      if (shouldShow) {
        // Small delay to not startle user immediately on load
        const timer = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Error checking announcement:', error);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    // Save current time and ID
    localStorage.setItem('announcement_seen', JSON.stringify({
      id: CURRENT_ANNOUNCEMENT.id,
      lastSeen: Date.now()
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default" className="bg-primary">{CURRENT_ANNOUNCEMENT.version}</Badge>
            <span className="text-sm text-muted-foreground">{CURRENT_ANNOUNCEMENT.date}</span>
          </div>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Megaphone className="h-6 w-6 text-orange-500 animate-bounce" />
            {CURRENT_ANNOUNCEMENT.title}
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {CURRENT_ANNOUNCEMENT.description}
          </DialogDescription>
        </DialogHeader>

        <div className="h-[300px] overflow-y-auto pr-4 mt-2">
          <div className="grid gap-4 py-4">
            {CURRENT_ANNOUNCEMENT.features.map((feature, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-lg bg-muted/40 border">
                <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex-1 text-xs text-muted-foreground self-center hidden sm:block">
            *หน้าต่างนี้จะแจ้งเตือนการอัปเดตใหม่ๆ ทุก 1 ชั่วโมง (หากยังไม่ได้อ่าน)
          </div>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            รับทราบและเข้าสู่ระบบ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
