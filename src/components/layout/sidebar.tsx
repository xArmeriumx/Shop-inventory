'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Truck,
  Send,
  Wallet,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Users,
  HelpCircle,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  FileText,
  ClipboardList,
  CheckCircle2,
  PackageCheck,
  ClipboardCheck,
  ArrowRightLeft,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Permission } from '@prisma/client';
import { usePermissions } from '@/hooks/use-permissions';
import { useSession } from 'next-auth/react';
import { UserActivityTracker } from '@/components/core/system/user-activity-tracker';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    id: 'sidebar-dashboard',
  },
  // --- Sales & Logistics ---
  {
    title: 'ใบเสนอราคา',
    href: '/quotations',
    icon: FileText,
    permission: 'QUOTATION_VIEW' as Permission,
  },
  {
    title: 'ขายสินค้า',
    href: '/sales',
    icon: ShoppingCart,
    permission: 'SALE_VIEW' as Permission,
    id: 'sidebar-sales',
  },
  {
    title: 'จัดส่งสินค้า',
    href: '/shipments',
    icon: Send,
    permission: 'SHIPMENT_VIEW' as Permission,
  },
  {
    title: 'ใบส่งของ',
    href: '/deliveries',
    icon: PackageCheck,
    permission: 'DELIVERY_VIEW' as Permission,
  },
  {
    title: 'คืนสินค้า',
    href: '/returns',
    icon: RotateCcw,
    permission: 'RETURN_VIEW' as Permission,
  },
  {
    title: 'ใบแจ้งหนี้',
    href: '/invoices',
    icon: Receipt,
    permission: 'SALE_VIEW' as Permission,
  },
  // --- Inventory ---

  {
    title: 'สินค้า',
    href: '/products',
    icon: Package,
    permission: 'PRODUCT_VIEW' as Permission,
    id: 'sidebar-products',
  },
  {
    title: 'คลังสินค้า',
    href: '/inventory/warehouses',
    icon: Truck,
    permission: 'WAREHOUSE_MANAGE' as Permission,
  },
  {
    title: 'ใบโอนสินค้า',
    href: '/inventory/transfers',
    icon: ArrowRightLeft as any, // Need to import or use cast
    permission: 'PRODUCT_UPDATE' as Permission,
  },
  {
    title: 'ตรวจนับสต็อก',
    href: '/inventory/stock-take',
    icon: ClipboardCheck as any,
    permission: 'STOCK_TAKE_VIEW' as Permission,
  },
  // --- Procurement ---
  {
    title: 'ขอซื้อสินค้า (PR)',
    href: '/order-requests',
    icon: ClipboardList,
    permission: 'ORDER_REQUEST_VIEW' as Permission,
  },
  {
    title: 'ซื้อสินค้า (PO)',
    href: '/purchases',
    icon: Receipt,
    permission: 'PURCHASE_VIEW' as Permission,
  },
  {
    title: 'ผู้จำหน่าย',
    href: '/suppliers',
    icon: Truck, // TODO: Use Building2?
    permission: 'PURCHASE_VIEW' as Permission,
  },
  // --- CRM & Others ---
  {
    title: 'ลูกค้า',
    href: '/customers',
    icon: Users,
    permission: 'CUSTOMER_VIEW' as Permission,
    id: 'sidebar-customers',
  },
  {
    title: 'ค่าใช้จ่าย',
    href: '/expenses',
    icon: Wallet,
    permission: 'EXPENSE_VIEW' as Permission,
  },
  {
    title: 'รายรับอื่นๆ',
    href: '/incomes',
    icon: TrendingUp,
    permission: 'INCOME_VIEW' as Permission,
  },
  {
    title: 'ผังบัญชี (CoA)',
    href: '/settings/accounting',
    icon: require('lucide-react').Library,
    permission: 'SETTINGS_SHOP' as Permission,
  },
  {
    title: 'บัญชีธนาคาร',
    href: '/accounting/banks',
    icon: Wallet,
    permission: 'SETTINGS_SHOP' as Permission,
  },
  {
    title: 'Bank Reconcile',
    href: '/accounting/reconcile',
    icon: CheckCircle2,
    permission: 'SETTINGS_SHOP' as Permission,
  },
  {
    title: 'AI ผู้ช่วย',
    href: '/ai',
    icon: Sparkles,
    id: 'sidebar-ai',
  },
];

const secondaryNavItems = [
  {
    title: 'รออนุมัติ',
    href: '/approvals',
    icon: CheckCircle2,
    permission: 'APPROVAL_VIEW' as Permission,
  },
  {
    title: 'รายงาน',
    href: '/reports',
    icon: BarChart3,
    permission: 'REPORT_VIEW_SALES' as Permission,
  },
  {
    title: 'แจ้งเตือนระบบ',
    href: '/system/notifications',
    icon: require('lucide-react').Bell,
  },
  {
    title: 'ตั้งค่า',
    href: '/settings',
    icon: Settings,
  },
  {
    title: 'คู่มือ',
    href: '/help',
    icon: HelpCircle,
  },
  {
    title: 'สถานะระบบ',
    href: '/system',
    icon: require('lucide-react').Activity,
    permission: 'SETTINGS_SHOP' as Permission,
  },
  {
    title: 'ประวัติการใช้งาน (Audit)',
    href: '/system/audit-logs',
    icon: ShieldCheck,
    permission: 'SETTINGS_SHOP' as Permission,
  },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void; // Close for mobile
  className?: string;
}

export function Sidebar({ isCollapsed = false, onToggle, onClose, className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { hasPermission } = usePermissions();

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo & Close Button (Mobile Only) */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            S
          </div>
          {(!isCollapsed || className?.includes('lg:hidden')) && (
            <span className="font-semibold">Shop Inventory</span>
          )}
        </Link>

        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}

        {!onClose && <UserActivityTracker />}
      </div>

      {/* Navigation — scrollable when many items */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-2">
        {/* POS Button - Prominent */}
        <Link
          href="/pos"
          className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 text-base font-bold transition-all mb-3',
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
            isCollapsed && 'justify-center px-2'
          )}
          title={isCollapsed ? 'POS' : undefined}
        >
          <ShoppingCart className="h-6 w-6 shrink-0" />
          {!isCollapsed && <span>POS</span>}
        </Link>

        <Separator className="my-2" />

        {navItems.map((item) => {
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }

          const isActive = pathname ? (pathname === item.href || pathname.startsWith(`${item.href}/`)) : false;
          return (
            <Link
              key={item.href}
              href={item.href}
              id={item.id}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          );
        })}

        <Separator className="my-4" />

        {secondaryNavItems.map((item) => {
          if (item.permission && !hasPermission(item.permission)) {
            return null;
          }

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                isCollapsed && 'justify-center px-2'
              )}
              title={isCollapsed ? item.title : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 text-muted-foreground hover:text-foreground',
            isCollapsed && 'justify-center px-2'
          )}
          onClick={() => import('next-auth/react').then(({ signOut }) => signOut())}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>ออกจากระบบ</span>}
        </Button>
      </div>

      {/* Collapse Toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted"
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              isCollapsed && 'rotate-180'
            )}
          />
        </button>
      )}
    </aside>
  );
}
