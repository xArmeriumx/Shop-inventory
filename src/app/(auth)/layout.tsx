import type { Metadata } from 'next';
import { LayoutGrid, ShieldCheck, TrendingUp, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ — Shop Inventory',
};

const FEATURE_HIGHLIGHTS = [
  { icon: Package, label: 'เช็คสต็อกและราคาสินค้า' },
  { icon: TrendingUp, label: 'บันทึกยอดขายและดูผลกำไร' },
  { icon: ShieldCheck, label: 'จัดการข้อมูลลูกค้าและคู่ค้า' },
  { icon: LayoutGrid, label: 'จัดการสมุดบัญชีเบื้องต้น' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Visual Branding Panel (hidden on mobile) ─────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative flex-col justify-between
                      bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] p-12 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px),
                              radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/5 blur-3xl" />

        {/* Logo & Product name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center
                            text-sm font-bold tracking-tight border border-white/20">
              ERP
            </div>
            <span className="text-sm font-medium opacity-80 tracking-widest uppercase">
              Shop Inventory
            </span>
          </div>
        </div>

        {/* Main headline */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
              ระบบจัดการสต็อก<br />
              <span className="opacity-60">และหน้าร้าน</span>
            </h1>
            <p className="mt-4 text-base opacity-60 leading-relaxed max-w-sm">
              ช่วยจดสต็อก บันทึกยอดขาย และดูแลบัญชีเบื้องต้น<br />
              ให้การจัดการร้านเป็นเรื่องง่ายและชัดเจน
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-3">
            {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm opacity-75">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-xs opacity-40 tracking-wide">
            Stock & Sales Management · Small Business Tool
          </p>
        </div>
      </div>

      {/* ── Right: Auth Form Panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center
                      p-6 sm:p-10 bg-background min-h-screen lg:min-h-0 overflow-y-auto">
        {/* Mobile-only mini brand header */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center
                            text-primary-foreground text-xs font-bold">
              ERP
            </div>
            <span className="text-sm font-semibold">Shop Inventory</span>
          </div>
        </div>

        {/* Actual form content (login / register card) */}
        <div className="w-full max-w-[400px]">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Shop Inventory · ระบบบริหารจัดการธุรกิจ
        </p>
      </div>
    </div>
  );
}

