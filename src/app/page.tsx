import { Metadata } from 'next';
import Link from 'next/link';
import {
  Package,
  ArrowRight,
  CheckCircle2,
  Download,
  ShoppingCart,
  Receipt,
  Truck,
  RotateCcw,
  DollarSign,
  BarChart3,
  Shield,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { SystemPreview } from '@/components/landing/system-preview';

export const metadata: Metadata = {
  title: 'Shop Inventory ERP | บริหารร้านครบวงจร จบในที่เดียว',
  description: 'ระบบจัดการสต็อก ขายหน้าร้าน และการเงินที่ออกแบบมาเพื่อธุรกิจไทย เชื่อมต่อข้อมูลทุกส่วนอัตโนมัติ ให้การบริหารเป็นเรื่องง่ายเหมือนปลอกกล้วย',
  keywords: ['ERP', 'POS', 'Inventory Management', 'ระบบสต็อกสินค้า', 'ระบบขายหน้าร้าน'],
};

const FEATURES = [
  {
    icon: Package,
    tag: 'สต็อก',
    title: 'จัดการสินค้าและสต็อก',
    desc: 'เพิ่มสินค้าพร้อมราคาทุน ราคาขาย บาร์โค้ด และจุดสั่งซื้อขั้นต่ำ ระบบแจ้งเตือนสินค้าใกล้หมดอัตโนมัติ พร้อมประวัติการเคลื่อนไหวสต็อกทุก Transaction',
    points: ['Import สินค้าจาก CSV', 'ประวัติ Stock Movement ย้อนหลัง', 'แจ้งเตือนสินค้าต่ำกว่าจุดสั่งซื้อ', 'รองรับหน่วยนับและบรรจุภัณฑ์'],
  },
  {
    icon: ShoppingCart,
    tag: 'POS',
    title: 'ระบบขายสินค้า (POS)',
    desc: 'สร้างบิลขายพร้อมส่วนลดทั้งระดับรายการและระดับบิล รองรับลูกค้าประจำ ออกใบเสร็จ Thermal 80mm และใบกำกับภาษี สต็อกหักอัตโนมัติเมื่อยืนยันการขาย',
    points: ['ส่วนลด % และ ฿ ให้เลือก', 'รองรับ 6 ช่องทางขาย', 'พิมพ์ Thermal 80mm', 'ใบกำกับภาษี / ใบเสร็จ A4'],
  },
  {
    icon: Receipt,
    tag: 'การซื้อ',
    title: 'ระบบสั่งซื้อและรับสินค้า',
    desc: 'สร้างใบขอซื้อ (PR) → ใบสั่งซื้อ (PO) → รับสินค้าเข้าคลัง ระบบอนุมัติแบบ Multi-step คำนวณต้นทุนเฉลี่ย (Weighted Average Cost) ทุกครั้งที่รับสินค้า',
    points: ['PR → PO → Receive Workflow', 'ตรวจสอบ MOQ ผู้จำหน่าย', 'คำนวณต้นทุนเฉลี่ยอัตโนมัติ', 'จัดการข้อมูลผู้จำหน่าย'],
  },
  {
    icon: Truck,
    tag: 'จัดส่ง',
    title: 'ติดตามการจัดส่ง',
    desc: 'บริหารสถานะพัสดุ 5 ขั้นตอนตั้งแต่รับออเดอร์ จัดเตรียม ส่งออก จนถึงส่งสำเร็จ บันทึกเลข Tracking ค่าขนส่ง และผูกกับรายการขายโดยตรง',
    points: ['5 สถานะ Workflow ชัดเจน', 'บันทึกเลข Tracking', 'คำนวณค่าขนส่งและน้ำหนัก', 'สแกน OCR ใบปะหน้า'],
  },
  {
    icon: RotateCcw,
    tag: 'คืนสินค้า',
    title: 'ระบบคืนสินค้า',
    desc: 'รองรับการคืนสินค้าทั้งหมดหรือบางส่วนจากบิลเดิม คำนวณยอดคืนเงินอัตโนมัติตามราคาที่ขาย สต็อกกลับคืนและปรับปรุงยอดกำไรของบิลนั้น Real-time',
    points: ['คืนสินค้าบางรายการได้', 'คำนวณยอดคืนอัตโนมัติ', 'คืนสต็อกและปรับกำไรทันที', 'บันทึกเหตุผลและวิธีคืนเงิน'],
  },
  {
    icon: DollarSign,
    tag: 'การเงิน',
    title: 'รายรับ-รายจ่าย',
    desc: 'บันทึกรายรับและรายจ่ายที่ไม่ใช่การขายสินค้า เช่น ค่าเช่า ค่าน้ำไฟ รายได้จากบริการ พร้อมแยกหมวดหมู่ เพื่อให้ Dashboard กำไรแม่นยำ',
    points: ['แยกหมวดหมู่รายรับ-รายจ่าย', 'สแกนใบเสร็จด้วย AI', 'Export เป็น CSV', 'รายงานรายเดือน-รายปี'],
  },
  {
    icon: BarChart3,
    tag: 'รายงาน',
    title: 'Dashboard และรายงาน',
    desc: 'ดูยอดขาย กำไรสุทธิ ค่าใช้จ่าย สินค้าขายดี และสุขภาพสต็อกแบบ Real-time กรองตามช่วงเวลา เปรียบเทียบรายเดือน และวิเคราะห์แนวโน้ม',
    points: ['ยอดขายและกำไร Real-time', 'สินค้าขายดีและสต็อกต่ำ', 'เปรียบเทียบ Month-over-Month', 'Export รายงาน'],
  },
  {
    icon: Shield,
    tag: 'ทีมงาน',
    title: 'สิทธิ์และการจัดการทีม',
    desc: 'กำหนดบทบาทสำหรับพนักงานแต่ละคนด้วย 35+ สิทธิ์ละเอียด เจ้าของเห็นได้ทุกอย่าง พนักงานเห็นเฉพาะส่วนที่ได้รับอนุญาต พร้อม Audit Log บันทึกทุก Action',
    points: ['35+ สิทธิ์กำหนดได้รายคน', 'Audit Log ทุก Action', 'แยกข้อมูลตามร้านอัตโนมัติ', 'บันทึกว่าใครแก้อะไร เมื่อไหร่'],
  },
  {
    icon: Package, // Using Package as a fallback for Warehouse if needed, but keeping original
    tag: 'คลังสินค้า',
    title: 'จัดการคลังสินค้า',
    desc: 'ค้นหาสินค้าด้วยบาร์โค้ด ปรับปรุงสต็อกแบบ Manual ด้วยเหตุผลที่ชัดเจน รับสินค้าเข้าคลังจากใบสั่งซื้อ และตรวจสอบสต็อก Real-time',
    points: ['สแกนบาร์โค้ดค้นหาสินค้า', 'ปรับสต็อกพร้อมระบุเหตุผล', 'รับสินค้าจากใบสั่งซื้อ', 'ตรวจนับสต็อก'],
  },
];

const STATS = [
  { value: '9', label: 'โมดูลหลัก', desc: 'ครบวงจรตั้งแต่สต็อกถึงรายงาน' },
  { value: '35+', label: 'สิทธิ์ผู้ใช้', desc: 'กำหนดได้รายละเอียดรายคน' },
  { value: '6', label: 'ช่องทางขาย', desc: 'หน้าร้าน, Shopee, LINE ฯลฯ' },
  { value: '2', label: 'รูปแบบการใช้งาน', desc: 'เว็บ + Desktop Application' },
];

const WORKFLOW = [
  {
    step: '01',
    icon: Package,
    title: 'ตั้งค่าร้านค้าและสินค้า',
    desc: 'เพิ่มสินค้า กำหนดราคาทุน ราคาขาย บาร์โค้ด และจุดสั่งซื้อขั้นต่ำ',
  },
  {
    step: '02',
    icon: Receipt,
    title: 'สั่งซื้อและรับสินค้าเข้าคลัง',
    desc: 'สร้างใบสั่งซื้อ รับสินค้าเข้าระบบ สต็อกและต้นทุนเฉลี่ยปรับให้อัตโนมัติ',
  },
  {
    step: '03',
    icon: ShoppingCart,
    title: 'บันทึกการขายและออกบิล',
    desc: 'ขายและสต็อกลดทันที พิมพ์ใบเสร็จหรือบันทึกออนไลน์ รองรับส่วนลดทุกรูปแบบ',
  },
  {
    step: '04',
    icon: Truck,
    title: 'จัดส่งและติดตามพัสดุ',
    desc: 'สร้างรายการจัดส่ง อัปเดตสถานะ บันทึกเลข Tracking และค่าขนส่ง',
  },
  {
    step: '05',
    icon: TrendingUp,
    title: 'ดูรายงานและวิเคราะห์',
    desc: 'Dashboard แสดงยอดขาย กำไร ค่าใช้จ่าย และสินค้าขายดีแบบ Real-time',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">

      {/* ── Navbar ────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center shrink-0">
              <Package className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="font-bold text-sm tracking-tight">Shop Inventory ERP</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/login" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted">เข้าสู่ระบบ</Link>
            <Link href="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90">
              ทดลองใช้งาน <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────── */}
      <section className="relative pt-24 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="relative container mx-auto px-4 sm:px-6 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-8">Professional ERP Solution</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-[1.1] mb-6">บริหารร้านครบวงจร<br /><span className="text-foreground/30 italic">จบในที่เดียว</span></h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">ระบบจัดการสต็อก ขายหน้าร้าน และการเงินที่ออกแบบมาเพื่อธุรกิจไทย เชื่อมต่อข้อมูลทุกส่วนอัตโนมัติ ให้การบริหารเป็นเรื่องง่ายเหมือนปลอกกล้วย</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-8 py-4 text-sm font-bold text-background shadow-lg shadow-foreground/10 hover:bg-foreground/90">
              ลองเล่นระบบ Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="https://github.com/xArmeriumx/shop-inventory-releases" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-border px-8 py-4 text-sm font-bold hover:bg-muted"><Download className="h-4 w-4" /> ดาวน์โหลดแอป Windows</a>
          </div>
        </div>
      </section>

      {/* ── Live Demo / Dashboard Mockup ──────── */}
      <section id="preview-section" className="py-20 relative px-4 sm:px-6">
        <div className="max-w-[1240px] mx-auto">
          <SystemPreview />
        </div>
      </section>

      {/* ── Stats ───────────────────────────── */}
      <section className="border-y bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50">
            {STATS.map((s) => (
              <div key={s.label} className="py-12 px-6 text-center">
                <div className="text-4xl md:text-5xl font-black tracking-tighter mb-2 italic text-foreground/80 underline decoration-foreground/10">{s.value}</div>
                <div className="text-sm font-bold uppercase tracking-widest text-foreground/60 mb-2">{s.label}</div>
                <div className="text-xs text-muted-foreground font-medium">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules — grid ───────────────────── */}
      <section className="py-24 md:py-32 bg-background relative overflow-hidden border-b">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mx-auto text-center mb-20 space-y-4">
            <div className="text-xs font-black uppercase tracking-widest text-foreground/40">Modules</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter">ครบทุกส่วนของธุรกิจ</h2>
            <p className="text-muted-foreground text-lg italic">ทุกโมดูลซิงค์กันอัตโนมัติ ข้อมูลเดียวกัน มองเห็นได้ทุกมุม</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {FEATURES.map((feat) => (
              <div key={feat.title} className="group rounded-[2.5rem] border bg-background p-8 flex flex-col gap-6 ring-1 ring-border shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background shrink-0 shadow-inner">
                    <feat.icon className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-2 rounded-full px-4 py-1.5 transition-colors">
                    {feat.tag}
                  </span>
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-black text-xl leading-snug tracking-tight">{feat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">{feat.desc}</p>
                </div>
                <ul className="space-y-2.5 border-t-2 border-dashed pt-6 mt-auto">
                  {feat.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-foreground/20 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow Segment ───────────────────── */}
      <section className="py-24 md:py-32 bg-muted/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="container mx-auto px-4 sm:px-6 relative">
          <div className="max-w-2xl mx-auto text-center mb-20 space-y-4">
            <div className="text-xs font-black uppercase tracking-widest text-foreground/40">The Process</div>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tighter">Workflow ที่ลื่นไหล</h2>
            <p className="text-muted-foreground text-lg">ตั้งแต่สินค้าชิ้นแรกเข้าคลัง จนถึงการวิเคราะห์กำไร ทุกขั้นตอนถูกออกแบบมาให้ง่ายที่สุด</p>
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Desktop Path Line */}
            <div className="hidden lg:block absolute top-[60px] left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-foreground/10 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 relative z-10">
              {WORKFLOW.map((item, idx) => (
                <div key={item.step} className="flex flex-col items-center text-center group">
                  <div className="relative mb-8">
                    <div className="h-28 w-28 rounded-[2.5rem] bg-background border ring-4 ring-muted/30 flex items-center justify-center shadow-xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent" />
                      <item.icon className="h-10 w-10 text-foreground" />
                      <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-foreground text-background text-[10px] font-black flex items-center justify-center border-4 border-background italic">
                        {item.step}
                      </div>
                    </div>
                    {/* Directional Arrow (Desktop only) */}
                    {idx < WORKFLOW.length - 1 && (
                      <div className="hidden lg:flex absolute top-1/2 -right-6 translate-y-[-50%] text-foreground/20">
                        <ChevronRight className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-black text-sm uppercase tracking-tight">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed px-2">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────── */}
      <section className="bg-foreground text-background py-24 md:py-40 relative">
        <div className="container mx-auto px-4 sm:px-6 text-center space-y-12">
          <h2 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-none italic">พร้อมใช้งาน<br /><span className="text-background/20 underline decoration-background/10">ทันที</span></h2>
          <p className="text-lg sm:text-xl text-background/50 max-w-lg mx-auto leading-relaxed font-medium uppercase tracking-tight">ไม่ต้องติดตั้ง ไม่ต้องตั้งค่าเซิร์ฟเวอร์ สมัครแล้วเริ่มขายได้เลย</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-background text-foreground px-12 py-5 text-lg font-black tracking-tighter hover:bg-background/90 shadow-xl">ยินดีต้อนรับ — เข้าสู่ระบบ</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer className="border-t py-12 bg-[#fbfbfc]">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-foreground flex items-center justify-center text-background font-black text-xs italic tracking-tighter">SI</div>
            <span className="text-sm font-black uppercase tracking-tighter">Shop Inventory ERP</span>
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">© 2026 Napatdev.com Build v0.5</p>
        </div>
      </footer>

    </main>
  );
}
