'use client';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { NotificationBell } from '@/components/core/notifications/notification-bell';
import { SafeBoundary } from '@/components/ui/safe-boundary';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { mainNavGroups, settingsNavItems } from '@/config/navigation';

interface HeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const pathname = usePathname();

  // Helper to get breadcrumbs from config
  const getBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs: { title: string; href: string }[] = [];

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;

      // Look for title in main nav
      let item = mainNavGroups.flatMap(g => g.items).find(i => i.href === currentPath);

      // Look for title in settings nav
      if (!item) {
        item = settingsNavItems.find(i => i.href === currentPath);
      }

      if (item) {
        breadcrumbs.push({ title: item.title, href: item.href });
      } else if (index === 0 && path === 'dashboard') {
        breadcrumbs.push({ title: 'Dashboard', href: '/dashboard' });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Breadcrumbs (Desktop) */}
      <nav className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </Link>
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.href} className="flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            <Link
              href={crumb.href}
              className={cn(
                "hover:text-foreground transition-colors truncate max-w-[150px]",
                idx === breadcrumbs.length - 1 && "text-foreground font-medium pointer-events-none"
              )}
            >
              {crumb.title}
            </Link>
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification Bell */}
      <SafeBoundary variant="compact" componentName="NotificationBell">
        <NotificationBell />
      </SafeBoundary>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user.name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {(user.name?.[0] || user.email?.[0] || 'U').toUpperCase()}
          </div>
        </div>
      )}
    </header>
  );
}
import { cn } from '@/lib/utils';
