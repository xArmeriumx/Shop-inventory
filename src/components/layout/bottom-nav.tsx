'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  BarChart3,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onMenuClick: () => void;
}

const navItems = [
  {
    href: '/dashboard',
    icon: LayoutDashboard,
    label: 'หน้าหลัก',
  },
  {
    href: '/products',
    icon: Package,
    label: 'สินค้า',
  },
  {
    href: '/pos',
    icon: ShoppingBag,
    label: 'POS',
    highlight: true,
  },
  {
    href: '/reports',
    icon: BarChart3,
    label: 'รายงาน',
  },
];

/**
 * Mobile Bottom Navigation Bar
 * Shows on mobile only (lg:hidden)
 */
export function BottomNav({ onMenuClick }: BottomNavProps) {
  const pathname = usePathname();

  // Don't show on POS page (has its own full-screen layout)
  if (pathname === '/pos') {
    return null;
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors touch-manipulation',
                item.highlight
                  ? 'text-primary'
                  : isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              )}
            >
              <div className={cn(
                'p-1.5 rounded-lg transition-colors',
                item.highlight && 'bg-primary/10',
                isActive && !item.highlight && 'bg-muted'
              )}>
                <Icon className={cn(
                  'h-5 w-5',
                  item.highlight && 'h-6 w-6'
                )} />
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                item.highlight && 'text-xs'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Menu Button */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground touch-manipulation"
        >
          <div className="p-1.5 rounded-lg">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium">เพิ่มเติม</span>
        </button>
      </div>
    </nav>
  );
}
