import Link from 'next/link';
import {
  Package,
  Receipt,
  BarChart3,
  Shield,
  Truck,
  Users,
  ScanLine,
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Download,
  Wifi,
  WifiOff,
  Printer,
  Maximize,
  AppWindow,
} from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      {/* ── Header ────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <Package className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-base tracking-tight">Shop Inventory</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
            >
              เข้าสู่ระบบ
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              เริ่มต้นใช้งาน
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

        <div className="relative container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3 w-3" />
              ระบบ POS ครบวงจรสำหรับร้านค้าไทย
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              บริหารร้านค้าของคุณ
              <br />
              <span className="bg-gradient-to-r from-foreground via-foreground/70 to-foreground bg-clip-text">
                ได้ง่ายกว่าที่เคย
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              จัดการสต็อก บันทึกขาย-ซื้อ ติดตามจัดส่ง วิเคราะห์กำไร
              ระบบเดียวครบ ใช้งานได้ทั้งมือถือและคอมพิวเตอร์
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href="https://github.com/xArmeriumx/shop-inventory-releases/releases/tag/download"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition-all hover:bg-foreground/90 active:scale-[0.98] shadow-lg shadow-foreground/10"
              >
                <Download className="h-4 w-4" />
                ดาวน์โหลดแอป
              </a>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-border px-8 py-3.5 text-sm font-medium transition-all hover:bg-muted active:scale-[0.98]"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              หรือ{' '}
              <Link href="/register" className="underline underline-offset-2 hover:text-foreground transition-colors">
                ใช้งานบนเว็บ
              </Link>
              {' '}ได้ทันทีไม่ต้องติดตั้ง
            </p>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ใช้งานฟรี
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ไม่ต้องติดตั้ง
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ข้อมูลปลอดภัย
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────── */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
            {[
              { value: '20', label: 'โมเดลฐานข้อมูล' },
              { value: '24', label: 'Server Actions' },
              { value: '35+', label: 'สิทธิ์รายละเอียด' },
              { value: '14', label: 'โมดูลฟีเจอร์' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              ทุกอย่างที่ร้านค้าต้องการ
            </h2>
            <p className="text-muted-foreground mt-3 text-sm md:text-base">
              ระบบครบวงจรตั้งแต่สต็อก ขาย ซื้อ จัดส่ง จนถึงวิเคราะห์กำไร
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              {
                icon: Package,
                title: 'จัดการสินค้า',
                desc: 'เพิ่ม แก้ไข ติดตามสต็อกแบบ Real-time พร้อมแจ้งเตือนสินค้าใกล้หมด และ Import ด้วย CSV',
              },
              {
                icon: Receipt,
                title: 'POS ขายหน้าร้าน',
                desc: 'สร้างบิลขาย ส่วนลดระดับรายการ+บิล พิมพ์ใบเสร็จ Thermal 80mm รองรับ 6 ช่องทางขาย',
              },
              {
                icon: BarChart3,
                title: 'รายงานกำไร-ขาดทุน',
                desc: 'Dashboard แสดงยอดขาย กำไร ค่าใช้จ่ายแบบ Real-time พร้อมกราฟวิเคราะห์แนวโน้ม',
              },
              {
                icon: Truck,
                title: 'ติดตามจัดส่ง',
                desc: 'ระบบ State Machine 5 สถานะ ตั้งแต่รอจัดส่ง จนถึงส่งสำเร็จ พร้อมบันทึกเลข Tracking',
              },
              {
                icon: Shield,
                title: 'RBAC สิทธิ์ละเอียด',
                desc: 'กำหนดบทบาทและ 35+ สิทธิ์ ให้พนักงานแต่ละคน ข้อมูลแยกตามร้านอัตโนมัติ',
              },
              {
                icon: ScanLine,
                title: 'AI สแกนใบเสร็จ',
                desc: 'ถ่ายรูปใบเสร็จ OCR อ่านข้อความ แล้ว AI แปลงเป็นข้อมูลสินค้า+ราคาอัตโนมัติ',
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className="group relative rounded-2xl border p-6 transition-all hover:border-foreground/20 hover:shadow-sm"
              >
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-4 transition-colors group-hover:bg-foreground group-hover:text-background">
                  <feat.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{feat.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Highlights ────────────────────────────── */}
      <section className="border-t bg-muted/20 py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                ออกแบบมาเพื่อ
                <br />
                ร้านค้าไทยโดยเฉพาะ
              </h2>
              <div className="space-y-4">
                {[
                  {
                    icon: Smartphone,
                    title: 'ใช้งานบนมือถือได้ 100%',
                    desc: 'Mobile-first design ทุกหน้าจอ ขายของที่งานแฟร์ก็ทำได้',
                  },
                  {
                    icon: Globe,
                    title: 'รองรับหลายช่องทางขาย',
                    desc: 'หน้าร้าน, Shopee, Lazada, LINE, Facebook รวมในระบบเดียว',
                  },
                  {
                    icon: Users,
                    title: 'หลายพนักงาน หลายสิทธิ์',
                    desc: 'เจ้าของดูได้ทุกอย่าง พนักงานเห็นเฉพาะส่วนที่ได้รับอนุญาต',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="h-9 w-9 rounded-lg bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="h-4 w-4 text-foreground/70" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual block */}
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-muted to-muted/50 border p-8 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-2.5 w-24 rounded-full bg-foreground/10" />
                  <div className="h-2 w-40 rounded-full bg-foreground/5" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {['ยอดขาย', 'กำไร', 'สต็อก'].map((label) => (
                    <div key={label} className="rounded-xl bg-background/80 border p-3 text-center">
                      <div className="text-lg font-bold">—</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-sm bg-foreground/10"
                      style={{ height: `${h}%`, minHeight: `${h * 0.6}px` }}
                    />
                  ))}
                </div>
              </div>
              {/* Floating card */}
              <div className="absolute -bottom-4 -left-4 rounded-xl bg-background border shadow-lg p-3.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold">ขายสำเร็จ</div>
                  <div className="text-[10px] text-muted-foreground">INV-00142 · ฿1,250</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Desktop App Download ───────────────────── */}
      <section className="border-t bg-foreground text-background py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            {/* Header + Download — centered */}
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-background/20 px-4 py-1.5 text-xs font-medium text-background/60">
                <Monitor className="h-3 w-3" />
                Desktop Application
              </div>

              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.15]">
                ติดตั้งแอป Desktop
                <br />
                <span className="text-background/50">เพื่อประสบการณ์ POS ที่ดีที่สุด</span>
              </h2>

              <p className="text-sm md:text-base text-background/50 max-w-lg mx-auto">
                ใช้งานได้เหมือนโปรแกรมทั่วไป พร้อมฟีเจอร์พิเศษที่เว็บทำไม่ได้
              </p>

              {/* Download button — large & prominent */}
              <div className="pt-2 flex flex-col items-center gap-4">
                <a
                  href="https://github.com/xArmeriumx/shop-inventory-releases/releases/tag/download"
                  className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-background text-foreground px-10 py-4 text-base font-semibold transition-all hover:bg-background/90 active:scale-[0.98]"
                >
                  <Download className="h-5 w-5" />
                  ดาวน์โหลดสำหรับ Windows
                </a>

                <div className="flex items-center gap-4 text-xs text-background/40">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-background/10 px-2.5 py-1">
                    v0.1.0
                  </span>
                  <span>Windows 10/11 (64-bit)</span>
                  <span>·</span>
                  <span>ฟรี 100%</span>
                </div>
              </div>
            </div>

            {/* App window mockup */}
            <div className="max-w-3xl mx-auto mb-16">
              <div className="rounded-xl border border-background/10 overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-background/5 border-b border-background/10">
                  <div className="flex items-center gap-2.5">
                    <div className="h-5 w-5 rounded bg-background/10 flex items-center justify-center">
                      <Package className="h-3 w-3 text-background/60" />
                    </div>
                    <span className="text-xs font-medium text-background/60">Shop Inventory</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-3 w-6 rounded-sm bg-background/10" />
                    <div className="h-3 w-6 rounded-sm bg-background/10" />
                    <div className="h-3 w-6 rounded-sm bg-background/10" />
                  </div>
                </div>
                {/* Mockup content */}
                <div className="p-6 md:p-8 bg-background/[0.03]">
                  <div className="flex items-center justify-between mb-6">
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-28 rounded-full bg-background/10" />
                      <div className="h-2 w-44 rounded-full bg-background/5" />
                    </div>
                    <div className="h-8 w-24 rounded-lg bg-background/10" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {['ยอดขาย', 'กำไร', 'สต็อก'].map((label) => (
                      <div key={label} className="rounded-lg bg-background/5 border border-background/10 p-4 text-center">
                        <div className="text-xl font-bold text-background/30">—</div>
                        <div className="text-[10px] text-background/25 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-1.5 h-16">
                    {[40, 65, 35, 80, 55, 70, 45, 85, 60, 50, 75, 40].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-background/8"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>



          </div>
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center space-y-6 rounded-3xl bg-foreground text-background p-10 md:p-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              พร้อมเริ่มบริหารร้านค้าแบบมืออาชีพ?
            </h2>
            <p className="text-sm text-background/60 max-w-md mx-auto">
              สมัครใช้งานฟรี เริ่มเพิ่มสินค้าและขายได้ทันที ไม่ต้องติดตั้งอะไรเพิ่ม
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-background text-foreground px-8 py-3.5 text-sm font-semibold transition-all hover:bg-background/90 active:scale-[0.98]"
              >
                สมัครใช้งานฟรี
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-background/20 text-background/80 px-8 py-3.5 text-sm font-medium transition-all hover:bg-background/10"
              >
                อ่านเอกสาร
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────── */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-foreground flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-background" />
              </div>
              <span className="text-sm font-semibold">Shop Inventory</span>
            </div>

            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground transition-colors">
                เอกสาร
              </Link>
              <a
                href="https://github.com/xArmeriumx/Shop-inventory"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              © 2026 Shop Inventory by{' '}
              <a
                href="https://napatdev.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:text-foreground transition-colors"
              >
                Napatdev.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
