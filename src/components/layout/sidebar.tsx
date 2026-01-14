'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'ขายสินค้า',
    href: '/sales',
    icon: ShoppingCart,
  },
  {
    title: 'สินค้า',
    href: '/products',
    icon: Package,
  },
  {
    title: 'ซื้อสินค้า',
    href: '/purchases',
    icon: Receipt,
  },
  {
    title: 'ลูกค้า',
    href: '/customers',
    icon: Users,
  },
  {
    title: 'ค่าใช้จ่าย',
    href: '/expenses',
    icon: Wallet,
  },
];

const secondaryNavItems = [
  {
    title: 'รายงาน',
    href: '/reports',
    icon: BarChart3,
  },
  {
    title: 'ตั้งค่า',
    href: '/settings',
    icon: Settings,
  },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>
            <span className="font-semibold">Shop Inventory</span>
          </Link>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold mx-auto">
            S
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
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

        <Separator className="my-4" />

        {secondaryNavItems.map((item) => {
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
