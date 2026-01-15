'use client';

import { useState, useEffect } from 'react';
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
import { Sparkles, ShieldCheck, Users, BarChart3, Package } from 'lucide-react';

// Current version - update this when you have new changes
const CURRENT_VERSION = '1.1.0';
const STORAGE_KEY = 'update-announcement-seen';

// Changelog data - add new updates at the top
const UPDATES = [
  {
    version: '1.1.0',
    date: '16 ม.ค. 2569',
    title: '🎉 ระบบ RBAC & จัดการทีม',
    highlights: [
      {
        icon: ShieldCheck,
        title: 'Role-Based Access Control',
        description: 'กำหนดสิทธิ์การเข้าถึงสำหรับสมาชิกในทีม',
      },
      {
        icon: Users,
        title: 'จัดการทีม',
        description: 'เพิ่มสมาชิกและกำหนด Role ได้ที่ ตั้งค่า > ทีม',
      },
      {
        icon: BarChart3,
        title: 'ซ่อนข้อมูลสำคัญ',
        description: 'ราคาทุนและกำไรแสดงเฉพาะผู้มีสิทธิ์',
      },
      {
        icon: Package,
        title: 'Multi-tenant Ready',
        description: 'รองรับหลายร้านค้าในอนาคต',
      },
    ],
    features: [
      '✅ สร้าง Role พร้อม Preset (ผู้จัดการ, แคชเชียร์, ดูแลสต็อก)',
      '✅ เชิญสมาชิกเข้าทีมด้วยอีเมล',
      '✅ Permission 30+ สิทธิ์ครอบคลุมทุกฟังก์ชัน',
      '✅ ซ่อนคอลัมน์ราคาทุน/กำไรตาม Permission',
      '✅ ซ่อนปุ่มลบ/ยกเลิกตาม Permission',
    ],
  },
];

export function UpdateAnnouncementModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen this version's announcement
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== CURRENT_VERSION) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  const latestUpdate = UPDATES[0];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-xl">{latestUpdate.title}</DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-2">
            <Badge variant="secondary">v{latestUpdate.version}</Badge>
            <span className="text-muted-foreground">{latestUpdate.date}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Highlights */}
          <div className="grid gap-3">
            {latestUpdate.highlights.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Feature List */}
          <div className="space-y-1.5 text-sm">
            {latestUpdate.features.map((feature, index) => (
              <p key={index} className="text-muted-foreground">
                {feature}
              </p>
            ))}
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button onClick={handleClose} className="w-full">
            เข้าใจแล้ว
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
