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
import { mainNavGroups } from '@/config/navigation';

const secondaryNavItems = [
  {
    title: 'คู่มือ',
    href: '/help',
    icon: HelpCircle,
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
        'flex h-full flex-col bg-background transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-full lg:w-64',
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

        <Separator className="my-2" />

        <div className="space-y-4">
          {mainNavGroups.map((group, idx) => {
            const visibleItems = group.items.filter(item => !item.permission || hasPermission(item.permission));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupName || `group-${idx}`} className="space-y-1">
                {group.groupName && !isCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1">
                    {group.groupName}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item, itemIdx) => {
                    if (item.isDivider) {
                      return <div key={`divider-${itemIdx}`} className="h-px bg-muted/30 mx-3 my-2" />;
                    }

                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                        {item.icon && <item.icon className="h-5 w-5 shrink-0" />}
                        {!isCollapsed && <span>{item.title}</span>}
                      </Link>
                    );
                  })}
                </div>
                {idx < mainNavGroups.length - 1 && <div className="h-px bg-muted/50 mx-2 mt-2" />}
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        {/* Essential Navigation (Always Visible) */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/settings')
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            isCollapsed && 'justify-center px-2'
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>ตั้งค่า (Settings)</span>}
        </Link>

        <Separator className="my-4" />

        {/* Action: Logout */}
        <div className="mt-auto pt-4">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 text-muted-foreground hover:text-foreground no-underline hover:no-underline',
              isCollapsed && 'justify-center px-2'
            )}
            onClick={() => import('next-auth/react').then(({ signOut }) => signOut())}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>ออกจากระบบ</span>}
          </Button>
        </div>
      </nav>

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
