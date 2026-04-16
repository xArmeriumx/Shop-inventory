'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PermissionProvider } from '@/contexts/permission-context';
import { SafeBoundary } from '@/components/ui/safe-boundary';

interface ClientLayoutProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function DashboardLayoutClient({ children, user }: ClientLayoutProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  return (
    <PermissionProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-full">
          <SafeBoundary variant="compact" componentName="Sidebar:Desktop">
            <Sidebar />
          </SafeBoundary>
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 transition-opacity" 
              onClick={() => setIsMobileOpen(false)}
            />
            
            {/* Drawer */}
            <div className="relative flex h-full w-64 flex-col bg-background shadow-xl border-r transition-transform animate-in slide-in-from-left duration-300">
              <SafeBoundary variant="compact" componentName="Sidebar:Mobile">
                <Sidebar />
              </SafeBoundary>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header 
            user={user} 
            onMenuClick={() => setIsMobileOpen(true)} 
          />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-4 lg:p-6 pb-20 lg:pb-6">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation */}
        <SafeBoundary variant="silent" componentName="BottomNav">
          <BottomNav onMenuClick={() => setIsMobileOpen(true)} />
        </SafeBoundary>
      </div>
    </PermissionProvider>
  );
}

