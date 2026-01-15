import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import { auth } from '@/lib/auth';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});



export const metadata: Metadata = {
  title: 'Shop Inventory | ระบบบริหารสต็อกและการขาย',
  description: 'ระบบบริหารสต็อกและการซื้อขายสำหรับร้านค้าขนาดเล็ก',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShopInv',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { AnnouncementPopup } from '@/components/features/announcements/announcement-popup';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers session={session}>
          {children}
          <Toaster richColors closeButton position="top-center" />
          <AnnouncementPopup />
        </Providers>
      </body>
    </html>
  );
}
