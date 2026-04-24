'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Users, Shield, ShoppingCart, CheckCircle2 } from 'lucide-react';

import { ArrowRight, Box, CreditCard, FileText, LucideIcon, Truck } from 'lucide-react';

const CURRENT_ANNOUNCEMENT = {
  id: 'update-v3.0-system-hardening',
  version: 'v3.0.0',
  date: '24 เมษายน 2569',
  title: 'บันทึกการอัปเดตระบบเวอร์ชัน 3.0.0 (System Update)',
  description: 'รายการปรับปรุงสถาปัตยกรรมและโครงสร้างข้อมูลเพื่อยกระดับความเสถียรของระบบ ERP',
  features: [
    {
      icon: Shield,
      title: 'Architectural Refactoring',
      description: 'ปรับปรุงโครงสร้างแบบ Domain-Driven (Rule of 6) เพื่อแยกส่วนงานให้เป็นระเบียบและลดโอกาสเกิดข้อผิดพลาดในการประมวลผล',
    },
    {
      icon: Megaphone,
      title: 'Document Lifecycle Integration',
      description: 'ระบบเชื่อมโยงลำดับเอกสาร (Quotation -> Sale -> Invoice) พร้อมสถานะนำทางที่ช่วยให้ติดตามสถานะงานได้แม่นยำ',
    },
    {
      icon: CheckCircle2,
      title: 'Data Integrity & SSOT',
      description: 'ปรับปรุงความถูกต้องของข้อมูล (Single Source of Truth) และการทำบัญชีภาษีเบื้องต้น (VAT/WHT) ให้ได้มาตรฐาน',
    },
    {
      icon: ShoppingCart,
      title: 'Inventory Logic Optimization',
      description: 'ปรับปรุงระบบบันทึกสต็อก (Stock Movement) และระบบการจองสินค้า (Reservation) ให้ทำงานเชื่อมต่อกันได้สมบูรณ์',
    },
    {
      icon: Users,
      title: 'UI/UX Standardization',
      description: 'ปรับปรุงส่วนติดต่อผู้ใช้งาน (User Interface) ให้เป็นมาตรฐานสากลและรองรับการแสดงผลผ่านอุปกรณ์เคลื่อนที่ 100%',
    },
    {
      icon: CheckCircle2,
      title: 'Performance & Hardening',
      description: 'เพิ่มความเสถียรในการทำงานภาพรวมและลดการใช้ทรัพยากรเครื่องคอมพิวเตอร์ในขณะประมวลผลข้อมูลขนาดใหญ่',
    },
  ],
};

const WORKFLOW_STEPS = [
  {
    icon: FileText,
    title: 'ฝ่ายจัดซื้อ/ขาย',
    subtitle: 'Quotation & PR',
    color: 'bg-blue-500',
    description: 'บันทึกใบเสนอราคาหรือใบขอซื้อ ระบบจะทำการคำนวณราคาและภาษีให้อัตโนมัติ',
  },
  {
    icon: Box,
    title: 'งานคลังสินค้า',
    subtitle: 'Soft-Lock Stock',
    color: 'bg-orange-500',
    description: 'เมื่อยืนยันออเดอร์ ระบบจะ "จองสต็อก" ทันที เพื่อป้องกันการขายเกินจำนวนจริง',
  },
  {
    icon: Truck,
    title: 'การจัดส่ง',
    subtitle: 'Shipment & DO',
    color: 'bg-amber-500',
    description: 'ตัดสต็อกจริงจากคลังสินค้าเมื่อระบุการจัดส่ง พร้อมบันทึกประวัติ Stock Movement',
  },
  {
    icon: CreditCard,
    title: 'การเงินบัญชี',
    subtitle: 'Invoice & Receipt',
    color: 'bg-emerald-500',
    description: 'ระบบออกใบแจ้งหนี้ ตรวจสอบสลิป และคำนวณกำไรสุทธิ (Gross Profit) ให้ทันที',
  },
];

export function AnnouncementPopup() {
  const [open, setOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (hasChecked) return;

    try {
      const seenData = localStorage.getItem('announcement_seen');
      let shouldShow = false;

      if (!seenData) {
        shouldShow = true;
      } else {
        const { id } = JSON.parse(seenData);
        if (id !== CURRENT_ANNOUNCEMENT.id) {
          shouldShow = true;
        }
      }

      if (shouldShow) {
        const timer = setTimeout(() => setOpen(true), 1500);
        setHasChecked(true);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error('Error checking announcement:', error);
    }
  }, [hasChecked]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem('announcement_seen', JSON.stringify({
      id: CURRENT_ANNOUNCEMENT.id,
      lastSeen: Date.now()
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl border-none shadow-2xl p-0 overflow-hidden bg-background/95 backdrop-blur-md animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Panel: Visual Flow */}
          <div className="w-full md:w-[320px] bg-zinc-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle,white_1px,transparent_1px)] [background-size:20px_20px]" />
            </div>

            <div className="relative z-10 space-y-4 animate-in slide-in-from-left duration-700 delay-150 fill-mode-both">
              <Badge variant="outline" className="text-zinc-400 border-zinc-700 bg-zinc-800/50 mb-4 font-mono uppercase tracking-widest text-[10px]">
                System Architecture v3.0
              </Badge>
              <h2 className="text-4xl font-bold leading-tight mb-2 tracking-tighter">ยกระดับ<br /><span className="text-orange-500">Workflow</span></h2>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-[200px]">
                ปรับปรุงระบบเบื้องหลังเพื่อการทำงานที่เชื่อมโยงกันอย่างเป็นระบบ
              </p>
            </div>

            <div className="relative z-10 space-y-6 animate-in fade-in slide-in-from-bottom duration-700 delay-300 fill-mode-both">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-colors cursor-default">
                <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold text-xs uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                  Data Integrity
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  ฐานข้อมูลใหม่รองรับการทำงานพร้อมกัน (Concurrency) ป้องกันข้อมูลคลาดเคลื่อน 100%
                </p>
              </div>
            </div>

            <div className="relative z-10 pt-8 mt-auto animate-in fade-in duration-1000 delay-500 fill-mode-both">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                Next-ERP Enterprise
              </p>
            </div>
          </div>

          {/* Right Panel: Feature Details */}
          <div className="flex-1 p-8 bg-background flex flex-col">
            <DialogHeader className="mb-8 animate-in fade-in slide-in-from-top duration-700">
              <div className="flex items-center justify-between mb-2">
                <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2 uppercase">
                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  Lifecycle Update
                </DialogTitle>
                <div className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase tracking-tighter border">
                  APR 2026
                </div>
              </div>
              <DialogDescription className="text-base leading-relaxed text-muted-foreground">
                การปฏิรูปสถาปัตยกรรมสู่โครงสร้างระดับอุตสาหกรรม (Phase 8: Structural Hardening)
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-3">
              {WORKFLOW_STEPS.map((step, index) => (
                <div
                  key={index}
                  className="group relative flex items-start gap-4 p-4 rounded-2xl border border-transparent bg-transparent hover:border-orange-200 hover:bg-orange-50/50 transition-all duration-500 cursor-default animate-in fade-in slide-in-from-right fill-mode-both"
                  style={{ animationDelay: `${400 + (index * 100)}ms` }}
                >
                  <div className={`p-2.5 rounded-xl ${step.color} bg-opacity-10 shrink-0 group-hover:bg-opacity-20 group-hover:scale-110 transition-all duration-300 ring-1 ring-inset ring-transparent group-hover:ring-orange-200/50`}>
                    <step.icon className={`h-5 w-5 ${step.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-[14px] text-foreground tracking-tight group-hover:text-orange-700 transition-colors">{step.title}</h4>
                      <Badge variant="outline" className="text-[9px] font-mono py-0 h-4 border-muted-foreground/20 text-muted-foreground uppercase tracking-widest bg-muted/50">
                        {step.subtitle}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-normal max-w-md group-hover:text-foreground/80 transition-colors">
                      {step.description}
                    </p>
                  </div>
                  {index < WORKFLOW_STEPS.length - 1 && (
                    <div className="absolute -bottom-3.5 left-7 w-[1px] h-3 bg-muted group-hover:bg-orange-200 transition-colors hidden md:block" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-auto flex items-center justify-end gap-4 pt-8 border-t animate-in fade-in slide-in-from-bottom duration-700 delay-1000 fill-mode-both">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mr-auto hidden sm:block">
                บันทึกการปรับปรุงระบบหลังบ้าน 100% Stable
              </p>
              <Button
                onClick={handleClose}
                className="bg-zinc-900 hover:bg-orange-600 text-white transition-all px-10 py-6 rounded-full font-bold shadow-xl hover:shadow-orange-200/50 active:scale-95 flex items-center gap-2"
              >
                เริ่มต้นใช้งาน Workflow ใหม่
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
